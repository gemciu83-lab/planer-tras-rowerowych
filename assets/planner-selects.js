'use strict';
// The two footer selects keep their original values/events; only their visible UI changes.
const mapSelectControls=[];
function closeMapSelects(){for(const control of mapSelectControls)control.close(false)}
function syncMapSelects(){for(const control of mapSelectControls)control.sync()}
function initMapSelects(){
 for(const id of ['mapProfile','mapBikeType']){
  const select=document.getElementById(id),tile=select.parentElement,label=tile.querySelector('label');
  const trigger=document.createElement('button'),value=document.createElement('span'),list=document.createElement('div');
  trigger.type='button';trigger.id=id+'Button';trigger.className='map-select-button';
  value.id=id+'Value';trigger.append(value);
  label.id=id+'Label';label.htmlFor=trigger.id;
  trigger.setAttribute('aria-labelledby',label.id+' '+value.id);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  list.id=id+'Options';list.className='map-select-options';list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',label.id);
  trigger.setAttribute('aria-controls',list.id);
  const options=Array.from(select.options),buttons=options.map((option,index)=>{
   const button=document.createElement('button');button.type='button';button.tabIndex=-1;button.className='map-select-option';button.textContent=option.textContent;
   button.setAttribute('role','option');button.dataset.value=option.value;button.disabled=option.disabled;
   button.addEventListener('click',()=>choose(index));list.append(button);return button;
  });
  let active=0,typed='',typedAt=0;
  function sync(){
   const index=options.findIndex(option=>option.value===select.value),selected=options[index];
   value.textContent=selected?selected.textContent:'';trigger.title=value.textContent;
   buttons.forEach((button,i)=>button.setAttribute('aria-selected',String(i===index)));
  }
  function close(restoreFocus){
   const wasOpen=!list.hidden;list.hidden=true;trigger.setAttribute('aria-expanded','false');tile.classList.remove('map-select-open');
   if(wasOpen&&restoreFocus)trigger.focus({preventScroll:true});
  }
  function focusOption(index){
   active=index;buttons[active].focus({preventScroll:true});buttons[active].scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function open(){
   closeMapSelects();sync();list.hidden=false;trigger.setAttribute('aria-expanded','true');tile.classList.add('map-select-open');
   focusOption(Math.max(0,options.findIndex(option=>option.value===select.value)));
  }
  function choose(index){
   if(options[index].disabled)return;
   const changed=select.value!==options[index].value;select.value=options[index].value;
   sync();close(true);if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  trigger.addEventListener('click',()=>list.hidden?open():close(false));
  trigger.addEventListener('keydown',event=>{
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();open();if(event.key==='Home')focusOption(0);if(event.key==='End')focusOption(buttons.length-1)}
  });
  list.addEventListener('keydown',event=>{
   if(event.key==='Tab'){close(false);return}
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return}
   let next=active;
   if(event.key==='ArrowDown')next=(active+1)%buttons.length;
   else if(event.key==='ArrowUp')next=(active+buttons.length-1)%buttons.length;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=buttons.length-1;
   else if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();choose(active);return}
   else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    const now=Date.now();typed=now-typedAt<700?typed+event.key:event.key;typedAt=now;
    const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pl');
    const match=options.findIndex(option=>normalize(option.textContent).startsWith(normalize(typed)));if(match>=0)next=match;
   }else return;
   event.preventDefault();event.stopPropagation();focusOption(next);
  });
  tile.addEventListener('focusout',event=>{if(!tile.contains(event.relatedTarget))close(false)});
  select.addEventListener('change',sync);select.hidden=true;select.tabIndex=-1;
  tile.append(trigger,list);mapSelectControls.push({tile,close,sync});sync();
 }
 document.addEventListener('pointerdown',event=>{for(const control of mapSelectControls)if(!control.tile.contains(event.target))control.close(false)});
}
