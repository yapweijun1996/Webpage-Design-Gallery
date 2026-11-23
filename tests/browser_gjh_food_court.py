"""Walk the public south gate to both stalls, sit in its four chairs, then leave the district."""
import argparse
from contextlib import ExitStack
import hashlib
import json
import math
from pathlib import Path
import subprocess
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright
from browser_gjh_district import DEMO, ROOT, SIZES, Visitor, enter, launch, probe_url, serve, write_json


def move_to(visitor, axis, target):
    page = visitor.page
    for _ in range(3):
        position = page.evaluate("axis=>__mall.state[axis]", axis)
        if abs(position - target) <= .35:
            return
        increasing = target > position
        yaw = (-math.pi / 2 if increasing else math.pi / 2) if axis == "x" else (math.pi if increasing else 0)
        visitor.face(yaw)
        limit = target - .23 if increasing else target + .23
        visitor.walk(f"__mall.state.{axis} {'>' if increasing else '<'} {limit}")
    actual = page.evaluate("axis=>__mall.state[axis]", axis)
    assert abs(actual - target) < .45, (axis, actual, target)


def activate(page, selector, touch):
    control = page.locator(selector)
    if touch:
        control.tap()
    else:
        control.focus()
        page.keyboard.press("Enter")


def run(options):
    out = options.evidence
    out.mkdir(exist_ok=True, parents=True)
    root = options.site_root.resolve()
    height, tier = SIZES[options.width]
    report = {"width":options.width, "quality":tier, "build":json.loads((root/"version.json").read_text())["build"],
              "commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip(),
              "views":{}, "responseHashes":{}, "errors":[]}
    try:
        with ExitStack() as stack:
            url = stack.enter_context(serve(root))
            pw = stack.enter_context(sync_playwright())
            chrome = stack.enter_context(launch(pw))
            report["chrome"] = chrome.version
            touch = options.width < 1000
            context = stack.enter_context(chrome.new_context(viewport={"width":options.width,"height":height}, has_touch=touch,
                                          device_scale_factor=2 if touch else 1, service_workers="block"))
            context.add_init_script("""if(window===top && /^https?:$/.test(location.protocol) && !window.name) {
              window.name='court-smoke';sessionStorage.setItem('gjh-v11-demo-bag-v1','{"new-moon-nz-425g-front":2}');}""")
            responses = {}
            def observed(response):
                path = urlsplit(response.url).path
                if response.status == 200 and ("/assets/districts/food-court/" in path or
                        path.endswith(("/food-court.js","/food-court-approach.js","/street-chunk.js","/script.bundle.js",
                                       "/world.bundle.js","/player.bundle.js"))):
                    responses[path] = response
            context.on("response", observed)
            failures = []
            def intercept(route):
                if not failures:
                    failures.append(route.request.url)
                    route.fulfill(status=503,body="")
                else:
                    route.continue_()
            if options.failure:
                context.route("**/assets/districts/food-court/chicken-rice-stall.glb",intercept)
            context.on("page",lambda page: page.on("pageerror",lambda error: report["errors"].append(str(error))))
            page = enter(context,probe_url(url),tier,observe=True)
            visitor = Visitor(context,page,options.width)
            page.evaluate("""() => {let frame=-1;window.courtDraws={count:0,peak:0};
              const mark=()=>{const s=__mall.state;if(s.frames!==frame){frame=s.frames;courtDraws.count++;courtDraws.peak=Math.max(courtDraws.peak,s.renderBudget.totalCalls);}requestAnimationFrame(mark)};mark();}""")
            def capture(label):
                page.wait_for_timeout(280)
                view = page.evaluate("""()=>{const s=__mall.state;return {x:s.x,y:s.y,z:s.z,yaw:s.yaw,zone:s.zone,
                  frame:s.frames,scene:s.graphics.sceneId,camera:s.graphics.cameraId,eye:s.camera.position,capsule:s.capsuleEnabled,
                  seat:s.seatId,phase:s.seatPhase,near:s.nearby,doors:Object.keys(s.doors).length,seats:s.seats,
                  district:s.district,gpu:s.gpu,draws:s.renderBudget.totalCalls,locale:document.documentElement.lang,
                  notice:document.querySelector('#street-gateway-status')?.textContent,bag:sessionStorage.getItem('gjh-v11-demo-bag-v1')};}""")
                if view["district"]["foodCourt"]["status"] == "ready":
                    view["sightlines"] = page.evaluate("""async view=>{
                      const T=await import('./vendor/three.module.min.js'), scene=mallProbe.scenes.get(view.scene);
                      const targets=view.phase==='seated'?[1.12,1.25,1.38]:[1,1.45,1.68], eye=new T.Vector3(...view.eye);
                      const layers=scene.children.filter(n=>n.name==='Singapore food court' || n.name==='Singapore neighbourhood street');
                      return Object.fromEntries(targets.map(h=>{
                        const d=new T.Vector3(view.x,view.y+h,view.z).sub(eye);
                        const ray=new T.Raycaster(eye,d.clone().normalize(),0,d.length()-.015);
                        return [h,ray.intersectObjects(layers,true).filter(hit=>hit.object.visible && hit.object.material.opacity>.5)
                          .map(hit=>({owner:hit.object.parent.name, material:hit.object.material.name, range:hit.distance}))];
                      }));
                    }""",view)
                report["views"][label] = view
                page.screenshot(path=str(out/(label+".png")),scale="css")
                write_json(out/"receipt.json",report)
                print(label, view["zone"], view["near"], round(view["x"],2),round(view["z"],2),view["draws"],flush=True)
                return view
            initial=capture("mall")
            visitor.face(math.pi)
            page.wait_for_function("__mall.state.district.status==='ready'",timeout=45000)
            move_to(visitor,"z",65.4)
            first=capture("street-before-court")
            assert first["zone"]=="singapore-street" and first["district"]["foodCourt"]["status"]=="distant"
            assert not any("/assets/districts/food-court/" in path for path in responses)
            move_to(visitor,"z",85)
            if options.failure:
                page.wait_for_function("__mall.state.district.foodCourt.status==='unavailable'")
                unavailable=capture("failed-layer")
                assert unavailable["capsule"] and unavailable["zone"]=="singapore-street" and unavailable["district"]["street"]["colliders"]>0
                move_to(visitor,"z",64);move_to(visitor,"z",85)
            page.wait_for_function("__mall.state.district.foodCourt.status==='ready'",timeout=45000)
            visitor.face(-math.pi/2)
            capture("public-approach")
            move_to(visitor,"x",21);visitor.face(math.pi)
            capture("hawker-stall")
            move_to(visitor,"x",24.95);move_to(visitor,"z",87.65);visitor.face(-2.8)
            served=capture("chicken-rice-stall")
            assert served["zone"]=="singapore-food-court" and served["district"]["foodCourt"]["seats"]==4
            seats={s["id"].split("-")[-1]:s for s in served["seats"] if s["id"].startswith("food-court-seat-")}
            assert set(seats)=={"west","north","east","south"}
            for direction,axes in [("west",("z","x")),("north",("z","x")),("east",("x","z")),("south",("z","x"))]:
                seat=seats[direction]
                for axis in axes:
                    move_to(visitor,axis,seat["exit"+axis.upper()])
                visitor.face({"west":-math.pi/2,"east":math.pi/2,"north":math.pi,"south":0}[direction])
                page.wait_for_function("id=>__mall.state.nearby===id",arg=seat["id"],timeout=6000)
                activate(page,"#inspect",touch)
                page.wait_for_function("id=>__mall.state.seatId===id && __mall.state.seatPhase==='seated'",arg=seat["id"])
                capture("sit-"+direction)
                if touch:
                    activate(page,"#inspect",True)
                else:
                    page.keyboard.press("Escape")
                page.wait_for_function("!__mall.state.seated && __mall.state.capsuleEnabled")
                stood=capture("stand-"+direction)
                assert math.hypot(stood["x"]-seat["exitX"],stood["z"]-seat["exitZ"])<.14
            move_to(visitor,"x",24.5);move_to(visitor,"z",85);move_to(visitor,"x",10);move_to(visitor,"z",63)
            away=capture("retired-on-street")
            assert away["district"]["foodCourt"]["status"]=="distant" and not any(s["id"].startswith("food-court-seat-") for s in away["seats"])
            move_to(visitor,"z",41)
            page.wait_for_function("__mall.state.district.status==='mall' && __mall.state.district.mall.rooms.models===34 && __mall.state.modelPreload.settled===__mall.state.modelPreload.total",timeout=270000)
            restored=capture("restored-mall")
            assert all(restored[k]==initial[k] for k in ("bag","scene","camera","doors","locale"))
            if options.map_return:
                visitor.face(math.pi);move_to(visitor,"z",85);move_to(visitor,"x",19)
                page.wait_for_function("__mall.state.district.foodCourt.status==='ready'")
                activate(page,"#header-map",touch)
                page.locator("#map-destination").select_option("planned-space-13")
                activate(page,"#map-visit",touch)
                page.wait_for_function("__mall.state.district.status==='mall' && !document.querySelector('#mall-map').open")
                mapped=capture("map-return")
                assert mapped["district"]["foodCourt"]["status"]=="distant" and math.hypot(mapped["x"]-32.6,mapped["z"]-12)<.1
            for path,response in responses.items():
                actual=hashlib.sha256(response.body()).hexdigest()
                assert actual==hashlib.sha256((root/path.lstrip("/")).read_bytes()).hexdigest(),path
                report["responseHashes"][path]=actual
            manifest=json.loads((root/DEMO/"assets/districts/food-court/sources.json").read_text())
            for a in manifest["assets"]:
                assert report["responseHashes"]["/"+DEMO+"assets/districts/food-court/"+a["file"]]==a["sha256"]
            assert not any(hits for v in report["views"].values() for hits in v.get("sightlines",{}).values()), "An opaque street surface hides the sampled visitor"
            report["draws"]=page.evaluate("courtDraws")
            assert report["draws"]["peak"]<=200 and not report["errors"],report["draws"]
            report["pass"]=True
    except Exception as error:
        report["error"]=str(error)
        raise
    finally:
        write_json(out/"receipt.json",report)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width",type=int,choices=SIZES,default=390)
    parser.add_argument("--evidence",type=Path,required=True)
    parser.add_argument("--site-root",type=Path,default=ROOT)
    parser.add_argument("--failure",action="store_true",help="Reject one optional stall file before the normal retry")
    parser.add_argument("--map-return",action="store_true",help="Also leave an active court through the public Map")
    run(parser.parse_args())
