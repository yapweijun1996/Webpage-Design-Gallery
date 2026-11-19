"""Capture reproducible front portraits from the live skinned player and NPC."""
import io
import json
from pathlib import Path

from PIL import Image
from mall_browser_probe import enter, launch, assert_teleport, scene_only

# The photographic pose is local to this disposable browser context. Preserve
# the renderer's real tier, materials, drawing buffer and post-processing.
PORTRAIT = """async ([subject, distance]) => {
  const T = await import(new URL('./vendor/three.module.min.js', location.href));
  const state = __mall.state;
  const scene = mallProbe.scenes.get(state.graphics.sceneId);
  const renderer = mallProbe.renderer;
  const isNpc = root => root.layers.mask === 4;
  const rigs = scene.children.flatMap(root => {
    const skins = [];
    root.traverse(node => { if (node.isSkinnedMesh) skins.push(node); });
    return skins.length ? [{root, skins}] : [];
  });
  const rig = rigs.find(({root, skins}) => subject === 'npc' ?
    isNpc(root) && skins.some(s => s.skeleton.bones.some(b => /^mixamorig:?Hips$/.test(b.name))) :
    !isNpc(root) && Math.hypot(root.position.x-state.x, root.position.z-state.z) < .25);
  if (!rig) throw Error('Missing live ' + subject + ' rig');
  const {root, skins} = rig;
  const original = root.position.clone();
  const hidden = rigs.map(({root}) => root.visible);
  // Use the same clear courtyard mark for both subjects, including a seated NPC.
  root.position.set(state.x, state.y, state.z);
  for (const skin of skins) skin.skeleton.pose();
  root.updateWorldMatrix(true, true);
  const bones = skins.flatMap(s => s.skeleton.bones);
  const joint = suffix => {
    const bone = bones.find(b => b.name.toLowerCase().endsWith(suffix.toLowerCase()));
    if (!bone) throw Error('Missing portrait joint ' + suffix);
    return bone.getWorldPosition(new T.Vector3());
  };
  const head = joint('Head'), left = joint('LeftHand'), right = joint('RightHand');
  const up = new T.Vector3(0,1,0);
  const forward = left.clone().sub(right).cross(up).normalize();
  const focus = head.clone().lerp(joint('Hips'), .45);
  const camera = new T.PerspectiveCamera(state.camera.fov, state.camera.aspect, .05, 200);
  camera.position.copy(focus).addScaledVector(forward, distance);
  camera.lookAt(focus);
  camera.updateMatrixWorld();
  const render = renderer.render;
  let drawn = false;
  renderer.render = function(s, c) {
    if (s !== scene || !c.isPerspectiveCamera) return render.call(this, s, c);
    camera.layers.mask = c.layers.mask;
    // Draw the staged visitor in the base pass even if admission would hide it
    // in the original gameplay view. Suppress a second copy in the NPC pass.
    const base = c.layers.isEnabled(0);
    for (const entry of rigs) entry.root.visible = entry === rig && base;
    if (base && subject === 'npc') camera.layers.enable(2);
    if (base) drawn = true;
    return render.call(this, s, camera);
  };
  try {
    __mall.step(0);
    if (!drawn) throw Error('Portrait world pass missing');
    // Preserve this exact post-composited buffer before the next browser frame.
    const still = document.getElementById('portrait-still') || new Image();
    still.id = 'portrait-still';
    still.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;visibility:visible!important';
    still.src = renderer.domElement.toDataURL('image/png');
    document.body.append(still);
    await still.decode();
    const point = p => { const v = p.clone().project(camera); return [(1+v.x)/2,(1-v.y)/2]; };
    const headPx = point(head), hipsPx = point(joint('Hips'));
    return {head:headPx, leftHand:point(left), rightHand:point(right),
      torso:Math.abs(headPx[1]-hipsPx[1]), camera:camera.position.toArray(),
      focus:focus.toArray(), buffer:[renderer.domElement.width, renderer.domElement.height], renderScale:__mall.performanceReport().renderScale,
      model:skins[0].geometry.name || skins[0].name, distance, subject};
  } finally {
    renderer.render = render;
    root.position.copy(original);
    rigs.forEach((entry,i) => entry.root.visible = hidden[i]);
  }
}"""


def crop_boxes(pose, width, height):
    unit = pose['torso'] * height
    boxes = {}
    for part, anchor, dy, rx, ry in (
        ('face', 'head', -.12, .30, .27), ('hair', 'head', -.40, .32, .20),
        ('left-hand', 'leftHand', 0, .17, .16), ('right-hand', 'rightHand', 0, .17, .16)
    ):
        x, y = pose[anchor]
        cx, cy = x * width, y * height + dy * unit
        box = (round(cx-rx*unit), round(cy-ry*unit), round(cx+rx*unit), round(cy+ry*unit))
        if not (0 <= box[0] < box[2] <= width and 0 <= box[1] < box[3] <= height):
            raise ValueError(f'{part} outside portrait: {box}')
        boxes[part] = box
    return boxes


def capture_baseline(url, device, destination):
    from playwright.sync_api import sync_playwright
    out = Path(destination)
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    with sync_playwright() as playwright:
        browser = launch(playwright)
        for preset in ([device] if device else ['desktop', 'phone']):
            phone = preset == 'phone'
            width, height, tier = (393, 700, 'low') if phone else (1920, 900, 'detailed')
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                                          is_mobile=phone, has_touch=phone, service_workers='block')
            context.add_init_script("localStorage.setItem('gjh-v11-mall-theme-v1','everyday')")
            page = enter(context, url, tier, observe=True)
            assert_teleport(page, 'atrium')
            page.wait_for_function("""() => {
              const scene = mallProbe.scenes.get(__mall.state.graphics.sceneId);
              return scene?.children.some(root => root.layers.mask === 4 &&
                root.getObjectsByProperty('isSkinnedMesh', true).some(skin =>
                  skin.skeleton.bones.some(b => /^mixamorig:?Hips$/.test(b.name))));
            }""", polling=250, timeout=90000)
            scene_only(page)
            page.add_style_tag(content='#scene {position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important}')
            page.evaluate("window.dispatchEvent(new Event('resize'))")
            page.evaluate('__mall.setInput({})')
            for subject in ['player', 'npc']:
                for distance in [5.2, 2.5]:
                    pose = page.evaluate(PORTRAIT, [subject, distance])
                    name = f'{preset}-{subject}-{distance:.1f}m'
                    image = Image.open(io.BytesIO(page.locator('#portrait-still').screenshot(type='png', scale='device')))
                    if image.size != (width, height):
                        raise ValueError(f'Unexpected native capture dimensions: {image.size}')
                    image.save(out / f'{name}.png')
                    boxes = crop_boxes(pose, *image.size)
                    for part, box in boxes.items():
                        image.crop(box).save(out / f'{name}-{part}.png')
                    manifest.append(dict(pose, name=name, tier=tier, size=image.size, boxes=boxes))
            context.close()
        browser.close()
    (out / 'poses.json').write_text(json.dumps(manifest, indent=2))
    return 0
