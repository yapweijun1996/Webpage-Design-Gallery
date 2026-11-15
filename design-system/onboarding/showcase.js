import {createOnboarding} from '../../assets/onboarding/onboarding.js';
import {createExperienceProfile} from '../../assets/onboarding/profiles.js';
const scene=document.querySelector('#sandbox'),result=document.querySelector('#result');
let component;
function mount(){
  component?.destroy();
  const profile=createExperienceProfile(document.querySelector('#profile').value);
  component=createOnboarding({...profile,scene,modes:['keyboard','touch','gamepad'],storageKey:'showcase',
    onAction:action=>{result.textContent=`Application callback: ${action}`;},onOpen:()=>{result.textContent='Application may pause for the modal.';}});
  component.setVisible(true);
}
mount();
document.querySelector('#profile').addEventListener('change',mount);
document.querySelector('#open').addEventListener('click',()=>{if(!document.querySelector('#onboarding-dialog'))mount();component.openWelcome();});
document.querySelector('#destroy').addEventListener('click',()=>{component.destroy();result.textContent='Components unmounted.';});
for(const node of document.querySelectorAll('[data-report]'))node.addEventListener('click',()=>component.report(node.dataset.report));
// Test/sandbox access is deliberately separate from the production library API.
window.onboardingSandbox={get component(){return component;}};
