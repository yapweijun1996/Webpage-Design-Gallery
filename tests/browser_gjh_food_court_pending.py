"""Read the food-court direction from the main pavement and leave through Map during a delayed retry."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import time
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

from browser_gjh_district import DEMO, ROOT, Visitor, enter, launch, probe_url, serve, write_json
from browser_gjh_food_court import activate, move_to


def run(root, out):
    out.mkdir(parents=True,exist_ok=True)
    info={"commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip(),
          "build":json.loads((root/"version.json").read_text())["build"],"events":[],"views":{},"errors":[]}
    start=time.monotonic()
    def event(name,detail=None):
        info["events"].append({"ms":round((time.monotonic()-start)*1000),"event":name,"detail":detail})
    try:
        with serve(root) as url, sync_playwright() as pw, launch(pw) as chrome, chrome.new_context(
                viewport={"width":390,"height":844},has_touch=True,device_scale_factor=2,service_workers="block") as ctx:
            info["browser"]=chrome.version
            ctx.add_init_script("""if(window===top && /^https?:$/.test(location.protocol) && !window.name){
              window.name='court-delay';sessionStorage.setItem('gjh-v11-demo-bag-v1','{"new-moon-nz-425g-front":2}');}""")
            ctx.on("page",lambda p:p.on("pageerror",lambda e:info["errors"].append(str(e))))
            held=[]; delay=False; responses={}
            def intercept(route):
                if delay:
                    held.append(route)
                    event("request held",route.request.url)
                else:
                    route.continue_()
            def observed(response):
                path=urlsplit(response.url).path
                if response.status==200 and ("/assets/districts/food-court/" in path or path.endswith(("/food-court.js","/food-court-approach.js","/street-chunk.js","/player.bundle.js","/world.bundle.js","/script.bundle.js"))):
                    responses.setdefault(path,response)
            ctx.on("response",observed)
            ctx.route("**/assets/districts/food-court/chicken-rice-stall.glb",intercept)
            ctx.on("requestfailed",lambda req:event("request failed",req.failure) if "chicken-rice-stall.glb" in req.url else None)
            page=enter(ctx,probe_url(url),"low",observe=True)
            visitor=Visitor(ctx,page,390)
            def capture(name):
                v=page.evaluate("""()=>{const s=__mall.state,chip=document.querySelector('#street-gateway-status');
                  return {x:s.x,y:s.y,z:s.z,eye:s.camera.position,yaw:s.yaw,frame:s.frames,draws:s.renderBudget.totalCalls,
                  scene:s.graphics.sceneId,camera:s.graphics.cameraId,zone:s.zone,capsule:s.capsuleEnabled,district:s.district,
                  notice:chip?.textContent,noticeVisible:!!chip?.getClientRects().length,seats:s.seats.map(i=>i.id),
                  bag:sessionStorage.getItem('gjh-v11-demo-bag-v1'),locale:document.documentElement.lang};}""")
                info["views"][name]=v
                page.screenshot(path=str(out/(name+".png")),scale="css")
                write_json(out/"receipt.json",info)
                print(name,v["zone"],v["district"]["foodCourt"],flush=True)
                return v
            initial=capture("before")
            visitor.face(math.pi);page.wait_for_function("__mall.state.district.status==='ready'")
            move_to(visitor,"z",85)
            page.wait_for_function("__mall.state.district.foodCourt.status==='ready' && document.querySelector('#street-gateway-status')?.textContent.includes('last row')")
            direction=capture("straight-ahead-direction")
            assert abs(direction["x"]-10)<.35 and direction["noticeVisible"] and direction["capsule"]
            assert direction["zone"]=="singapore-street" and direction["notice"]=="Food court beside the last row of shophouses."
            move_to(visitor,"x",22.7);move_to(visitor,"z",87.7)
            visitor.face(2.96);capture("browsing-kettle-stall")
            visitor.face(-2.61);capture("browsing-chicken-rice")
            move_to(visitor,"z",85);move_to(visitor,"x",10);move_to(visitor,"z",63.5)
            away=capture("retired");assert away["district"]["foodCourt"]=={"status":"distant"}
            delay=True
            move_to(visitor,"z",84)
            page.wait_for_function("__mall.state.district.foodCourt.status==='loading'")
            assert len(held)==1
            v=capture("loading-on-through-street")
            assert v["capsule"] and v["zone"]=="singapore-street" and v["district"]["street"]["colliders"]>0
            move_to(visitor,"x",18.7)
            v=capture("walkable-during-delay")
            assert v["capsule"] and v["zone"]=="singapore-street" and v["district"]["foodCourt"]["status"]=="loading"
            activate(page,"#header-map",True);page.locator("#map-destination").select_option("planned-space-13")
            activate(page,"#map-visit",True)
            page.wait_for_function("__mall.state.district.status==='mall' && !document.querySelector('#mall-map').open")
            event("returned through Map")
            original=(root/DEMO/"assets/districts/food-court/chicken-rice-stall.glb").read_bytes()
            try:
                held[0].fulfill(status=200,body=original,content_type="model/gltf-binary")
                event("released late response")
            except Exception as error:
                if not any(term in str(error).lower() for term in ("cancel","invalid","interception","already handled")): raise
                event("browser already cancelled outstanding request",str(error))
            page.wait_for_function("__mall.state.district.mall.rooms.models===34 && __mall.state.modelPreload.settled===__mall.state.modelPreload.total",timeout=270000)
            page.wait_for_timeout(450)
            v=capture("after-late-response")
            assert math.hypot(v["x"]-32.6,v["z"]-12)<.1 and v["district"]["foodCourt"]=={"status":"distant"} and v["district"]["street"]["colliders"]==0
            assert not any(s.startswith("food-court-seat-") for s in v["seats"])
            assert all(v[k]==initial[k] for k in ("bag","camera","scene","locale")) and not info["errors"]
            info["responseHashes"]={}
            for path,response in responses.items():
                digest=hashlib.sha256(response.body()).hexdigest()
                assert digest==hashlib.sha256((root/path.lstrip("/")).read_bytes()).hexdigest()
                info["responseHashes"][path]=digest
            assert len([p for p in responses if "/food-court/" in p and p.endswith(".glb")])==4
            info["pass"]=True
    except Exception as error:
        info["error"]=str(error)
        raise
    finally:
        write_json(out/"receipt.json",info)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root",type=Path,default=ROOT)
    parser.add_argument("--evidence",type=Path,required=True)
    args=parser.parse_args()
    run(args.site_root.resolve(),args.evidence)
