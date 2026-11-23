"""Enter the Malaysian lane through the expanded Map and walk its two house frontages."""
import argparse
from contextlib import ExitStack
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright
from browser_gjh_district import ROOT, SIZES, Visitor, enter, launch, probe_url, serve, write_json
from browser_gjh_food_court import activate, move_to
from browser_gjh_mili_catalogue import language


def run(options):
    out = options.evidence
    out.mkdir(parents=True, exist_ok=True)
    root = options.site_root.resolve()
    height, tier = SIZES[options.width]
    report = {"width": options.width, "tier": tier, "build": json.loads((root/"version.json").read_text())["build"],
              "views": {}, "responses": {}, "errors": []}
    with ExitStack() as stack:
        url = stack.enter_context(serve(root))
        pw = stack.enter_context(sync_playwright())
        browser = stack.enter_context(launch(pw))
        report["chrome"] = browser.version
        touch = options.width < 1000
        context = stack.enter_context(browser.new_context(viewport={"width": options.width, "height": height},
                                      has_touch=touch, device_scale_factor=1, service_workers="allow" if options.offline else "block"))
        context.add_init_script("""if(location.protocol==='http:' && window===top && !window.name){
            window.name='kampung-visit';sessionStorage.setItem('gjh-v11-demo-bag-v1','{"new-moon-nz-425g-front":2}');}""")
        responses = {}
        def response_seen(response):
            path = urlsplit(response.url).path
            if response.status == 200 and ("/districts/" in path or path.endswith(("/kampung-lane.js","/script.bundle.js","/world.bundle.js","/player.bundle.js"))):
                responses[path] = response
        context.on("response", response_seen)
        context.on("page", lambda p: p.on("pageerror", lambda error: report["errors"].append(str(error))))
        page = enter(context, probe_url(url), tier, observe=True)
        visitor = Visitor(context, page, options.width)

        page.evaluate("""() => {let last=-1;window.laneDraws={count:0,peak:0};
          function sample(){const state=__mall.state;if(state.frames!==last){last=state.frames;
            laneDraws.count++;laneDraws.peak=Math.max(laneDraws.peak,state.renderBudget.totalCalls);}requestAnimationFrame(sample);}sample();}""")

        def close_map():
            if page.locator("#map-close").is_visible():
                activate(page, "#map-close", touch)
            else:
                page.keyboard.press("Escape")
            page.wait_for_function("!document.querySelector('#mall-map').open")

        def record(label):
            state = page.evaluate("""() => {const s=__mall.state;return {zone:s.zone,x:s.x,y:s.y,z:s.z,capsule:s.capsuleEnabled,
              camera:s.camera,view:s.cameraObstruction,sceneId:s.graphics.sceneId,cameraId:s.graphics.cameraId,
              bag:sessionStorage.getItem('gjh-v11-demo-bag-v1'),district:s.district,draws:s.renderBudget.totalCalls,
              triangles:s.renderTriangles,title:document.getElementById('location-name')?.textContent,
              context:document.querySelector('#hud-context')?.hidden?null:document.querySelector('#hud-context')?.dataset.context,
              locationTitle:document.querySelector('#location-map').title,
              mapVisible:document.querySelector('#mall-map').open};}""")
            report["views"][label] = state
            page.screenshot(path=str(out/(label+".png")), scale="css")
            write_json(out/"receipt.json", report)
            print(label, state["zone"], state["draws"], flush=True)
            assert state["capsule"] and 0 < state["draws"] <= 200
            return state

        def open_destination():
            activate(page,"#header-map",touch)
            expect(page.locator("#mall-map")).to_have_attribute("open","")
            page.select_option("#map-destination","malaysia-kampung")

        try:
            initial = record("mall")
            assert not any("/malaysia/" in path for path in responses)
            open_destination()
            if options.offline:
                page.wait_for_function("navigator.serviceWorker.controller?.scriptURL.endsWith('/v11/pwa-sw.js')", timeout=45000)
                context.set_offline(True)
                activate(page,"#map-visit",touch)
                expect(page.locator("#map-travel-status")).to_contain_text("unavailable",timeout=35000)
                assert record("cold-offline")["zone"] == initial["zone"]
                context.set_offline(False)
            if options.failure:
                # Hold the first real load and dismiss the map before bytes are available.
                pending=[]
                target = "**/districts/malaysia/kampung-house.glb"
                page.route(target, lambda route: pending.append(route))
                activate(page,"#map-visit",touch)
                for _ in range(150):
                    if pending:
                        break
                    page.wait_for_timeout(100)
                assert pending, "the first house request must be pending"
                close_map()
                pending[0].abort()
                page.unroute(target)
                cancelled=record("cancelled")
                assert cancelled["zone"] == initial["zone"] and cancelled["district"]["kampung"] is None
                open_destination()
                # Fail after the module is fetched so retry uses a fresh model request.
                target = "**/districts/malaysia/kampung-house.glb"
                page.route(target, lambda route: route.abort())
                activate(page,"#map-visit",touch)
                expect(page.locator("#map-travel-status")).to_contain_text("unavailable",timeout=30000)
                assert record("failed")["zone"] == initial["zone"]
                page.unroute(target)
            activate(page,"#map-visit",touch)
            page.wait_for_function("__mall.state.zone==='malaysia-kampung' && !document.querySelector('#mall-map').open",timeout=30000)
            page.wait_for_timeout(350)
            arrival = record("lane-entry")
            assert arrival["district"]["kampung"]["models"] == 3 and arrival["view"]["avatarVisible"]
            assert arrival["bag"] == initial["bag"] and arrival.get("context") != "quest"
            activate(page,"#hud-objectives summary",touch)
            expect(page.locator("#hud-objectives")).to_have_attribute("open","")
            activate(page,"#hud-objectives summary",touch)
            activate(page,"#bag-open",touch)
            expect(page.locator("#bag-items li")).to_have_count(1)
            activate(page,"#bag-close",touch)
            report["laneControls"]={"objectivesOpened":True,"bagOpened":True}
            if options.languages:
                report["languages"]={}
                for code,region,short,action in (("en","Malaysia · Kampung lane","Kampung","Return to GJH courtyard"),
                        ("zh-Hans","马来西亚 · 甘榜小巷","甘榜小巷","返回 GJH 庭院"),
                        ("ms","Malaysia · Lorong kampung","Kampung","Kembali ke laman GJH")):
                    if code != "en":
                        language(page,code,touch)
                    expect(page.locator("#location-name")).to_have_text(short)
                    open_destination()
                    expect(page.locator('#map-destination option:checked')).to_have_text(region)
                    expect(page.locator('#map-visit')).to_have_text(action)
                    report["languages"][code] = {"title":page.locator("#location-map").get_attribute("title"),"action":action,"region":region}
                    close_map()
                language(page,"en",touch)
            move_to(visitor,"z",72);visitor.face(math.pi/2);record("raised-timber-house")
            move_to(visitor,"z",90);visitor.face(math.pi/2);record("terrace-porch")
            if not options.quick:
                move_to(visitor,"z",96); move_to(visitor,"x",314.2)
                move_to(visitor,"z",80);visitor.face(-math.pi/2);record("opposite-verge")
                move_to(visitor,"z",66)
            open_destination()
            expect(page.locator("#map-visit")).to_have_text("Return to GJH courtyard")
            assert page.locator("#player-dot").evaluate("element=>getComputedStyle(element).display==='none'")
            record("map-return")
            activate(page,"#map-visit",touch)
            page.wait_for_function("__mall.state.zone==='atrium' && !document.querySelector('#mall-map').open")
            returned = record("returned")
            assert abs(returned["x"]-10)<.4 and abs(returned["z"]-12)<.4 and returned["district"]["kampung"] is None
            assert (returned["bag"],returned["sceneId"],returned["cameraId"]) == (initial["bag"],initial["sceneId"],initial["cameraId"])
            if options.width == 1440:
                open_destination();activate(page,"#map-visit",touch)
                page.wait_for_function("__mall.state.zone==='malaysia-kampung' && !document.querySelector('#mall-map').open")
                open_destination();page.select_option("#map-destination", "sony")
                activate(page,"#map-visit",touch)
                page.wait_for_function("!__mall.state.district.kampung && !document.querySelector('#mall-map').open")
                storefront=record("map-store-return")
                assert storefront["bag"] == initial["bag"] and storefront["x"] < 100
            if options.offline:
                page.wait_for_function("!!navigator.serviceWorker.controller",timeout=45000)
                context.set_offline(True)
                open_destination();activate(page,"#map-visit",touch)
                page.wait_for_function("__mall.state.zone==='malaysia-kampung'",timeout=30000)
                record("warm-offline")
                open_destination();activate(page,"#map-visit",touch)
                page.wait_for_function("__mall.state.zone==='atrium'")
                record("offline-return")
                model="assets/districts/malaysia/kampung-house.glb"
                length=(root/"demos/corporate/gjh/v11"/model).stat().st_size
                report["offlineRanges"]=page.evaluate("""async ([path,size])=>{const reads=[];for(const range of ['bytes=0-3','bytes='+size+'-']){
                    const r=await fetch(path,{headers:{Range:range}});reads.push([r.status,r.headers.get('Content-Range'),await r.text()]);}return reads;}""",[model,length])
                assert report["offlineRanges"] == [[206,f"bytes 0-3/{length}","glTF"],[416,f"bytes */{length}",""]]
                context.set_offline(False)
            report["draws"]=page.evaluate("laneDraws")
            assert report["draws"]["count"]>0 and report["draws"]["peak"]<=200
            for path,response in responses.items():
                digest=hashlib.sha256(response.body()).hexdigest()
                assert digest==hashlib.sha256((root/path.lstrip("/")).read_bytes()).hexdigest(),path
                report["responses"][path] = digest
            assert not report["errors"],report["errors"]
            report["pass"]=True
        except Exception as error:
            report["failure"]=str(error)
            page.screenshot(path=str(out/"failure.png"),scale="css")
            raise
        finally:
            write_json(out/"receipt.json",report)


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root",type=Path,default=ROOT)
    parser.add_argument("--width",type=int,choices=SIZES,default=390)
    parser.add_argument("--evidence",type=Path,required=True)
    parser.add_argument("--quick",action="store_true")
    parser.add_argument("--failure",action="store_true")
    parser.add_argument("--offline",action="store_true")
    parser.add_argument("--languages",action="store_true")
    run(parser.parse_args())
