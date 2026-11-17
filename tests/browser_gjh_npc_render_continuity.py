"""Verify a real seated NPC renders continuously within the real draw budget."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=ROOT)) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                    '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'metal'), '--ignore-gpu-blocklist'])
                page = browser.new_page(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
                page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                page.route('**/assets/npcs.js', lambda route: route.fulfill(content_type='text/javascript', body="""
                  import {createNpcSystem as createSystem} from './npcs.js?original';
                  export function createNpcSystem(T, options) {
                    const system=createSystem(T,options); window.npcTest={options,system}; return system;
                  }
                """))
                page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/#experience')
                page.wait_for_function('window.__sceneReady && window.npcTest',timeout=90000)
                # This test does not exercise early entry: let preparation finish normally.
                page.locator('#app-loader').wait_for(state='hidden',timeout=90000)
                result=page.evaluate('''() => {
                  const {scene,seats}=npcTest.options,system=npcTest.system;
                  __mall.teleport('mili'); __mall.setInput({forward:0}); __mall.step(500);
                  for(let i=0;i<64;i++)__mall.step(17);
                  const sitters=()=>scene.children.filter(root=>root.isGroup && root.layers.mask===4 && root.getObjectByName('Head'));
                  const seatAt=p=>seats.find(seat=>system.occupiedSeatIds.includes(seat.id) && Math.hypot(seat.x-p.x,seat.z-p.z)<.01);
                  const sitter=sitters().find(root=>seatAt(root.position) && root.visible);
                  if(!sitter)return {found:false,state:__mall.state.npcs,budget:__mall.state.renderBudget};
                  const seat=seatAt(sitter.position),start=sitter.position.toArray();
                  let meshDraws=0,renderedFrames=0,retained=true,hidden=0,maxTotal=0,maxNpc=0;
                  sitter.traverse(node=>{if(!node.isMesh)return;const old=node.onAfterRender;node.onAfterRender=function(...args){meshDraws++;return old.apply(this,args);};});
                  for(let i=0;i<250;i++){
                    const previous=meshDraws;__mall.step(100);const s=__mall.state;
                    if(!scene.children.includes(sitter)){retained=false;break;}
                    if(!sitter.visible)hidden++;
                    if(meshDraws>previous)renderedFrames++;
                    maxTotal=Math.max(maxTotal,s.renderBudget.totalCalls);maxNpc=Math.max(maxNpc,s.renderBudget.npcCalls);
                  }
                  return {found:true,seat:seat.id,retained,occupied:system.occupiedSeatIds.includes(seat.id),start,end:sitter.position.toArray(),hidden,renderedFrames,meshDraws,maxTotal,maxNpc,cost:system.state.callsPerNpc};
                }''')
                assert result['found'] and result['retained'] and result['occupied'],result
                assert result['start']==result['end'] and result['hidden']==0,result
                assert result['renderedFrames']==250 and result['maxTotal']<=200,result
                print('PASS real selected seated NPC rendered continuously within budget',result)
                browser.close()
        finally:
            server.shutdown()
            thread.join()

if __name__ == '__main__':
    run()
