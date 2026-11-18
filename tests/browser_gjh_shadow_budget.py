"""Verify shelf and visitor shadow policies in real Chrome at each quality tier."""
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
from browser_gjh_v11 import dismiss_tutorial, drive

ROOT = Path(__file__).resolve().parents[1]


def run():
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT))) as server, sync_playwright() as playwright:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader'])
        try:
            for width, height, quality, expected in ((1440, 900, 'detailed', True), (1440, 900, 'balanced', False), (1440, 900, 'low', False), (390, 844, 'detailed', False)):
                context = browser.new_context(viewport={'width':width, 'height':height}, reduced_motion='reduce', service_workers='block')
                context.add_init_script(f"localStorage.setItem('gjh-v11-graphics-quality-v1','{quality}')")
                page = context.new_page()
                page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?visitor=v2#experience')
                page.locator('#app-loader').wait_for(state='hidden', timeout=120000)
                page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=90000)
                dismiss_tutorial(page)
                page.evaluate('''async () => {
                  const T = await import('./vendor/three.module.min.js');
                  const original = T.Scene.prototype.onBeforeRender;
                  T.Scene.prototype.onBeforeRender = function(renderer,...args) {
                    if (this.uuid === __mall.state.graphics.sceneId) window.__shadowScene = this;
                    return original.call(this,renderer,...args);
                  };
                  __mall.teleport('newmoon'); __mall.setInput({}); __mall.step(17);
                }''')
                drive(page, 1000)
                sample = page.evaluate('''() => {
                  const scene=window.__shadowScene, proxy=scene.getObjectByName('Product shelf shadow');
                  const result={proxy:Boolean(proxy), visible:proxy?.visible, caster:proxy?.castShadow,
                    instances:proxy?.count, colorWrite:proxy?.material.colorWrite,
                    shadowState:__mall.state.graphics.shadows, details:{}, silhouette:[]};
                  scene.traverse(node => {
                    if (!node.isMesh || !(node.layers.mask & 1)) return;
                    if (/^V2_(body_Glasses_and_eyes|glasses_Glasses_and_eyes|body_Warm_smile|watch_Glasses_and_eyes)$/.test(node.name)) result.details[node.name]=node.castShadow;
                    if (/^V2_(body_Warm_peach_skin|outfit_GJH_emerald_polo|shoes_Cream_white)$/.test(node.name)) result.silhouette.push(node.castShadow);
                  });
                  return result;
                }''')
                assert sample['proxy'] and sample['caster'] and sample['instances'] >= 4, sample
                assert sample['colorWrite'] is False and sample['shadowState'] is expected and sample['visible'] is expected, sample
                assert len(sample['details']) == 4 and not any(sample['details'].values()), sample
                assert sample['silhouette'] and all(sample['silhouette']), sample
                print(f'PASS {width}x{height} {quality}: shelf proxy and visitor silhouette', flush=True)
                context.close()
            # Exercise the texture-based product fallback, including the
            # startup pack bypass, so missing GLBs do not reintroduce casters.
            context = browser.new_context(viewport={'width':1440, 'height':900}, reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.route('**/startup-assets.pack*', lambda route: route.fulfill(status=503, body='unavailable'))
            page.route('**/new-moon-can-*-lod1.glb*', lambda route: route.fulfill(status=503, body='unavailable'))
            page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/#experience')
            page.locator('#app-loader').wait_for(state='hidden', timeout=120000)
            page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=90000)
            dismiss_tutorial(page)
            fallback = page.evaluate("""async () => {
              const T=await import('./vendor/three.module.min.js'); let scene;
              const original=T.Scene.prototype.onBeforeRender;
              T.Scene.prototype.onBeforeRender=function(renderer,...args){
                if(this.uuid===__mall.state.graphics.sceneId)scene=this;
                return original.call(this,renderer,...args);
              };
              __mall.teleport('newmoon'); __mall.setInput({}); __mall.step(17);
              const meshes=[];scene.traverse(node=>{
                if(node.isInstancedMesh && node.count>=51 && ['LatheGeometry','CylinderGeometry'].includes(node.geometry.type))
                  meshes.push({type:node.geometry.type,cast:node.castShadow});
              });
              return {status:Object.values(__mall.state.productAssets.cans).map(item=>item.status),meshes};
            }""")
            assert fallback['status'] == ['fallback'] * 4, fallback
            assert sum(mesh['type']=='LatheGeometry' for mesh in fallback['meshes']) == 4, fallback
            assert sum(mesh['type']=='CylinderGeometry' for mesh in fallback['meshes']) >= 4, fallback
            assert not any(mesh['cast'] for mesh in fallback['meshes']), fallback
            print('PASS missing product GLBs: fallback cans do not add shadow passes', flush=True)
            context.close()
        finally:
            browser.close()
            server.shutdown()


if __name__ == '__main__':
    run()
