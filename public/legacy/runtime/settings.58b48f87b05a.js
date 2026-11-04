(function(){const panel=document.getElementById('kx-settings');if(panel&&!panel.querySelector('.settings-panel-body')){const body=document.createElement('div');body.className='settings-panel-body';for(const child of [...panel.children])if(child.tagName!=='SUMMARY')body.append(child);panel.append(body)}if(panel&&!document.getElementById('konaSettingsHeading')){const heading=document.createElement('h2');heading.id='konaSettingsHeading';heading.textContent=KonaI18n.t('Settings');panel.querySelector('.settings-panel-body').prepend(heading)}})();
try{/* The language setting is separate from journal backups and saved records. */
(function(){
 const body=document.querySelector('#kx-settings .settings-panel-body');if(!body)return;
 const section=document.createElement('section');section.className='display-settings kona-language-settings';
 const row=document.createElement('label');row.className='display-setting-row';
 const words=document.createElement('span');words.textContent='언어 / Language';
 const select=document.createElement('select');select.id='konaLanguage';select.dataset.konaSetting='language';select.setAttribute('aria-label','언어 / Language');
 for(const [value,label] of [['en','English'],['ko','한국어']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
 select.value=KonaI18n.language;
 const status=document.createElement('p');status.className='display-settings-status';status.setAttribute('role','status');
 select.onchange=()=>{if(window.konaCanChangeLanguage&&!window.konaCanChangeLanguage()){select.value=KonaI18n.language;return}if(!KonaI18n.setLanguage(select.value)){select.value=KonaI18n.language;status.textContent=KonaI18n.language==='ko'?'언어를 저장하지 못했어요. 다시 시도해 주세요.':'Language could not be saved. Please retry.'}};
 row.append(words,select);section.append(row,status);const heading=document.getElementById('konaSettingsHeading');if(heading)heading.after(section);else body.prepend(section);
})();

/* Android/browser Back closes the top UI layer before navigating away. */
(function(){
 let active=null,closing=false;
 function close(layer){closing=true;if(layer.matches('.archive-back'))layer.click();else layer.open=false;closing=false}
 function arm(layer){if(closing||active===layer)return;if(active)close(active);active=layer;history.pushState({...history.state,konaUILayer:true},'',location.href)}
 document.addEventListener('toggle',e=>{const node=e.target;if(!node.matches?.('.rv-entry-menu,#kx-settings'))return;if(node.open)arm(node);else if(active===node){active=null;if(history.state?.konaUILayer)history.back()}},true);
 new MutationObserver(()=>{const back=document.querySelector('.archive-detail .archive-back');if(back&&active!==back)arm(back)}).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('popstate',e=>{if(!active)return;const layer=active;active=null;close(layer);e.stopImmediatePropagation()},true);
 document.addEventListener('click',e=>{if(active?.matches('.rv-entry-menu')&&!active.contains(e.target)){const layer=active;active=null;close(layer);if(history.state?.konaUILayer)history.back()}},true);
})();
}catch(error){console.error("Settings initialization",error);const panel=document.querySelector("#kx-settings .settings-panel-body");if(panel){const message=document.createElement("p");message.setAttribute("role","alert");message.textContent="Settings: "+error.message;panel.append(message)}}
try{;/* Device-local display preferences: never rewrite journal records. */
(function(){
 const KEY='kona.display.v1',defaults={theme:'system',size:'13.5',spacing:'compact',motion:false};
 const validate=p=>({theme:['system','light','dark'].includes(p?.theme)?p.theme:'system',size:['13.5','15','17','19'].includes(p?.size)?p.size:'13.5',spacing:['compact','standard','relaxed'].includes(p?.spacing)?p.spacing:'compact',motion:p?.motion===true});
 let prefs;try{prefs=validate(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{prefs={...defaults}}
 const media=matchMedia('(prefers-color-scheme: dark)'),root=document.documentElement;
 function apply(){const dark=prefs.theme==='dark'||prefs.theme==='system'&&media.matches;root.dataset.appearance=dark?'dark':'light';root.dataset.reducedMotion=String(prefs.motion);root.style.colorScheme=dark?'dark':'light';root.style.setProperty('--reading-size','13.5px');root.style.setProperty('--kona-ui-scale',String(Number(prefs.size)/13.5));root.dataset.uiEnlarged=String(prefs.size!=='13.5');root.style.setProperty('--reading-line',String(({compact:1.225,standard:1.45,relaxed:1.7})[prefs.spacing]));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#18231f':'#faf8f3')}
 apply();media.addEventListener('change',apply);window.addEventListener('storage',e=>{if(e.key===KEY){try{prefs=validate(JSON.parse(e.newValue||'{}'));apply();sync()}catch{}}});
 const body=document.querySelector('#kx-settings .settings-panel-body');if(!body)return;
 const icon=document.querySelector('.app-settings-shortcut');if(icon){icon.replaceChildren();const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');for(const d of ['M12.22 2h-.44a2 2 0 0 0-2 1.72l-.12.87a2 2 0 0 1-1.18 1.52l-.27.12a2 2 0 0 1-1.9-.18l-.7-.54a2 2 0 0 0-2.64.65l-.22.38a2 2 0 0 0 .64 2.72l.7.53a2 2 0 0 1 .7 1.74v.32a2 2 0 0 1-.7 1.74l-.7.53a2 2 0 0 0-.64 2.72l.22.38a2 2 0 0 0 2.64.65l.7-.54a2 2 0 0 1 1.9-.18l.27.12a2 2 0 0 1 1.18 1.52l.12.87a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.12-.87a2 2 0 0 1 1.18-1.52l.27-.12a2 2 0 0 1 1.9.18l.7.54a2 2 0 0 0 2.64-.65l.22-.39a2 2 0 0 0-.64-2.72l-.7-.52a2 2 0 0 1-.7-1.74v-.32a2 2 0 0 1 .7-1.74l.7-.53a2 2 0 0 0 .64-2.72l-.22-.38a2 2 0 0 0-2.64-.65l-.7.54a2 2 0 0 1-1.9.18l-.27-.12a2 2 0 0 1-1.18-1.52l-.12-.87a2 2 0 0 0-2-1.72Z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0']){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path)}icon.append(svg)}
 const section=document.createElement('section');section.className='display-settings';const heading=document.createElement('h2');heading.textContent=KonaI18n.t("Appearance & reading");section.append(heading);const hint=document.createElement('p');hint.textContent=KonaI18n.t("Personalize this device. Notes and saved records stay unchanged.");hint.className='display-settings-hint';section.append(hint);
 const controls={};function choice(key,label,options,help){const row=document.createElement('label');row.className='display-setting-row';const words=document.createElement('span');words.textContent=label;if(help){const small=document.createElement('small');small.textContent=help;words.append(small)}const field=document.createElement('select');field.setAttribute('aria-label',label);for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;field.append(option)}field.onchange=()=>commit({...prefs,[key]:field.value});controls[key]=field;field.dataset.konaSetting=key;row.append(words,field);section.append(row)}
 choice('theme',KonaI18n.t("Theme"),[['system',KonaI18n.t("System")],['light',KonaI18n.t("Light")],['dark',KonaI18n.t("Dark")]],KonaI18n.t("Follow your device or choose a theme."));choice('size',KonaI18n.t("UI text size"),[['13.5',KonaI18n.t("Default · 13.5")],['15',KonaI18n.t("Medium · 15")],['17',KonaI18n.t("Large · 17")],['19',KonaI18n.t("Extra large · 19")]],KonaI18n.t("Applies to all tabs, controls and notes on this device."));choice('spacing',KonaI18n.t("Line spacing"),[['compact',KonaI18n.t("Compact")],['standard',KonaI18n.t("Standard")],['relaxed',KonaI18n.t("Relaxed")]]);
 const motionRow=document.createElement('label');motionRow.className='display-setting-row';const motionLabel=document.createElement('span');motionLabel.textContent=KonaI18n.t("Reduce animation");const motion=document.createElement('input');motion.type='checkbox';motion.setAttribute('aria-label',KonaI18n.t("Reduce animation",true));motion.onchange=()=>commit({...prefs,motion:motion.checked});controls.motion=motion;motion.dataset.konaSetting="motion";motionRow.append(motionLabel,motion);section.append(motionRow);
 const preview=document.createElement('div');preview.className='display-reading-preview';preview.textContent=KonaI18n.t("A moment to remember.\n오늘의 생각을 편하게 읽어보세요.");section.append(preview);const reset=document.createElement('button');reset.type='button';reset.textContent=KonaI18n.t("Reset display settings");reset.className='display-settings-reset';reset.onclick=()=>commit({...defaults});section.append(reset);const status=document.createElement('p');status.className='display-settings-status';status.setAttribute('role','status');section.append(status);
 function sync(){for(const key of ['theme','size','spacing'])controls[key].value=prefs[key];motion.checked=prefs.motion}function commit(next){const old=prefs;prefs=validate(next);try{localStorage.setItem(KEY,JSON.stringify(prefs));apply();status.textContent=KonaI18n.t("Saved on this device")}catch{prefs=old;apply();status.textContent=KonaI18n.t("Not saved. Please retry.")}sync()}
 const settingsHeading=document.getElementById('konaSettingsHeading');if(settingsHeading)body.prepend(settingsHeading,section);else body.prepend(section);sync();
})();

}catch(error){console.error("Settings initialization",error);const panel=document.querySelector("#kx-settings .settings-panel-body");if(panel){const message=document.createElement("p");message.setAttribute("role","alert");message.textContent="Settings: "+error.message;panel.append(message)}}
try{;/* Settings: existing tools plus persisted Review preferences. */
(function(){
 const panel=document.getElementById('kx-settings'),body=panel?.querySelector('.settings-panel-body');if(!body)return;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
 const status=node('p','','settings-save-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 function section(title){const n=node('section',null,'kona-settings-section');n.append(node('h2',title));return n}
 function row(parent,label,field,help){const r=node('label',null,'kona-settings-row'),words=node('span',label);if(help)words.append(node('small',help));field.setAttribute('aria-label',label);r.append(words,field);parent.append(r)}
 const schedule=section(KonaI18n.t("Schedule")),journal=section(KonaI18n.t("Journal & Review")),data=section(KonaI18n.t("Data & privacy"));
 const manage=node('button',KonaI18n.t("Manage"),'mini-btn');manage.type='button';manage.onclick=()=>{panel.open=false;panel.dispatchEvent(new Event('toggle'));nav('schedule',{sub:'events'})};row(schedule,KonaI18n.t("Daily routines"),manage,'Edit repeat rules in Plan; choose this day or the series.');
 const zone=node('select');for(const z of ZONES)zone.append(new Option(z.label+' · '+z.utc,z.id));zone.value=zoneInfo().id;row(schedule,KonaI18n.t("Time zone"),zone,KonaI18n.t("Applies to the clock and new timestamps. Existing records keep their date and time."));
 function apply(){const prefs=konaReviewPreferences();document.documentElement.style.setProperty('--review-preview-lines',String(prefs.previewLines||3))}
 function commit(key,value,field,previous){if(tutorialPractice){field.type==='checkbox'?field.checked=previous:field.value=String(previous);status.textContent=KonaI18n.t("Exit practice to change settings.");return}const had=Object.prototype.hasOwnProperty.call(db.settings,key),old=db.settings[key];db.settings[key]=value;if(!save()){if(had)db.settings[key]=old;else delete db.settings[key];if(field.type==='checkbox')field.checked=previous;else field.value=String(previous);status.textContent=KonaI18n.t("Not saved · retry.");return}apply();render();status.textContent=KonaI18n.t("Saved on this device")}
 zone.dataset.konaSetting='zone';zone.onchange=()=>commit('zone',zone.value,zone,zoneInfo().id);
 const prefs=konaReviewPreferences();
 for(const [key,label,checked,help] of [['reviewShowTimes',KonaI18n.t("Show schedule times in Review"),prefs.showTimes,KonaI18n.t("Show the event’s start and end times.")],['reviewShowEmpty',KonaI18n.t("Show events without notes"),prefs.showEmpty,KonaI18n.t("Off: Review shows recorded events and independent notes.")]]){const f=node('input');f.type='checkbox';f.dataset.reviewSetting=key;f.dataset.konaSetting=key;f.checked=checked;f.onchange=()=>commit(key,f.checked,f,!f.checked);row(journal,label,f,help)}
 const preview=node('select');for(const [v,label] of [[2,KonaI18n.t("2 lines")],[3,KonaI18n.t("3 lines")],[5,KonaI18n.t("5 lines")],[0,KonaI18n.t("Full text")]])preview.append(new Option(label,String(v)));preview.dataset.konaSetting='reviewPreviewLines';preview.value=String(prefs.previewLines);preview.onchange=()=>commit('reviewPreviewLines',Number(preview.value),preview,konaReviewPreferences().previewLines);row(journal,KonaI18n.t("Record preview"),preview,KonaI18n.t("Read more expands an individual note without changing this setting."));
 const reflection=body.querySelector('.reflection-settings-open');if(reflection)journal.append(reflection);
 data.append(node('h3',KonaI18n.t("Records backup")));const backup=document.getElementById('reviewBackupStatus');if(backup){data.append(backup);backup.querySelector('#backupNow').textContent=KonaI18n.t("Export records");backup.querySelector('#restoreNow').textContent=KonaI18n.t("Restore records")}data.append(node('p',KonaI18n.t("Records backup scope"),'settings-help'));
 data.append(node('h3',KonaI18n.t("Device settings backup")));const settingsActions=node('div',null,'review-entry-actions'),exportSettings=node('button',KonaI18n.t("Export settings"),'mini-btn'),restoreSettings=node('button',KonaI18n.t("Restore settings"),'mini-btn'),settingsFile=node('input');settingsFile.type='file';settingsFile.accept='.json,application/json';settingsFile.hidden=true;settingsFile.setAttribute('aria-label',KonaI18n.t("Settings backup file",true));exportSettings.type=restoreSettings.type='button';exportSettings.onclick=konaExportDeviceSettings;restoreSettings.onclick=()=>settingsFile.click();settingsFile.onchange=()=>{konaRestoreDeviceSettings(settingsFile.files?.[0]);settingsFile.value=''};settingsActions.append(exportSettings,restoreSettings);data.append(settingsActions,settingsFile,node('p',KonaI18n.t("Device settings backup scope"),'settings-help'),node('p',KonaI18n.t("Local autosave and export help"),'settings-help'));
 const appearance=body.querySelector('.display-settings'),actions=body.querySelector('.review-reset-link');
 body.append(schedule,journal);if(appearance)body.append(appearance);body.append(data,status);if(actions)body.append(actions);
 // One Reflection settings entry in Settings, rather than a duplicate beside Review.
 const shortcut=document.getElementById('review-reflection-settings');if(shortcut){shortcut.hidden=true;shortcut.setAttribute('aria-hidden','true')}
 panel.addEventListener('toggle',()=>{if(panel.open){zone.value=zoneInfo().id;const p=konaReviewPreferences();preview.value=String(p.previewLines);journal.querySelector('[data-review-setting="reviewShowTimes"]').checked=p.showTimes;journal.querySelector('[data-review-setting="reviewShowEmpty"]').checked=p.showEmpty}});
 apply();
})();

}catch(error){console.error("Settings initialization",error);const panel=document.querySelector("#kx-settings .settings-panel-body");if(panel){const message=document.createElement("p");message.setAttribute("role","alert");message.textContent="Settings: "+error.message;panel.append(message)}}
/* Stage settings together; explicit Apply persists them and reloads once. */
(function(){
 const panel=document.getElementById('kx-settings'),body=panel?.querySelector('.settings-panel-body');if(!body)return;
 const t=s=>KonaI18n.t(s),fields=()=>[...body.querySelectorAll('[data-kona-setting]')];
 const actions=document.createElement('div');actions.className='settings-apply-actions';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const apply=document.createElement('button');apply.type='button';apply.className='solid';apply.id='konaApplySettings';apply.textContent=t('Apply settings');apply.disabled=true;
 actions.append(status,apply);body.append(actions);let baseline=new Map();
 const value=f=>f.type==='checkbox'?f.checked:f.value;
 function capture(){baseline=new Map(fields().map(f=>[f,value(f)]));apply.disabled=true;status.textContent=''}
 function changed(){apply.disabled=!fields().some(f=>value(f)!==baseline.get(f));status.textContent=apply.disabled?'':t('Changes are not applied yet.');}
 panel.addEventListener('change',e=>{if(!e.target.matches('[data-kona-setting]'))return;e.stopImmediatePropagation();changed()},true);
 // Reset changes the draft; Apply is still required.
 panel.addEventListener('click',e=>{if(!e.target.closest('.display-settings-reset'))return;e.preventDefault();e.stopImmediatePropagation();for(const f of fields()){const defaults={theme:'system',size:'13.5',spacing:'compact',motion:false};if(f.dataset.konaSetting in defaults){if(f.type==='checkbox')f.checked=defaults[f.dataset.konaSetting];else f.value=defaults[f.dataset.konaSetting]}}changed()},true);
 panel.addEventListener('toggle',()=>{if(panel.open){capture()}else{for(const [f,v]of baseline){if(f.type==='checkbox')f.checked=v;else f.value=v}apply.disabled=true;status.textContent=''}});
 apply.onclick=()=>{
  if(tutorialPractice){status.textContent=t('Exit practice to change settings.');return}
  if(sess.started){status.textContent=t('End the timer before applying settings.');return}
  if(window.konaCanChangeLanguage&&!window.konaCanChangeLanguage())return;
  const selected=Object.fromEntries(fields().map(f=>[f.dataset.konaSetting,value(f)]));
  if(!['en','ko'].includes(selected.language)||!['13.5','15','17','19'].includes(selected.size)||!['system','light','dark'].includes(selected.theme)||!['compact','standard','relaxed'].includes(selected.spacing)||![0,2,3,5].includes(Number(selected.reviewPreviewLines))||!ZONES.some(z=>z.id===selected.zone)){status.textContent=t('Settings could not be saved. Please retry.');return}
  const store=window.localStorage,keys=['kona.legacy.v1.dayframe','kona.legacy.v1.kona.display.v1',KonaI18n.key],oldSettings={...db.settings};let before;try{before=keys.map(k=>store.getItem(k))}catch{status.textContent=t('Settings could not be saved. Please retry.');return}
  try{
   db.settings={...db.settings,zone:selected.zone,reviewShowTimes:selected.reviewShowTimes,reviewShowEmpty:selected.reviewShowEmpty,reviewPreviewLines:Number(selected.reviewPreviewLines)};
   if(!save())throw Error('record settings');
   store.setItem(keys[1],JSON.stringify({theme:selected.theme,size:selected.size,spacing:selected.spacing,motion:selected.motion}));store.setItem(keys[2],selected.language);
   if(store.getItem(keys[1])!==JSON.stringify({theme:selected.theme,size:selected.size,spacing:selected.spacing,motion:selected.motion})||store.getItem(keys[2])!==selected.language)throw Error('verification');
  }catch{db.settings=oldSettings;for(let i=0;i<keys.length;i++)try{before[i]===null?store.removeItem(keys[i]):store.setItem(keys[i],before[i])}catch{}status.textContent=t('Settings could not be saved. Please retry.');return}
  apply.disabled=true;window.location.reload();
 };
 capture();
})();

/* Inline styles and newly-created SVG labels use the same typography scale. */
(function(){
 function scaleNode(node){if(node.nodeType!==1)return;for(const property of ['font-size','line-height']){const raw=node.style?.getPropertyValue(property);if(raw&&/^\d+(\.\d+)?px$/.test(raw.trim()))node.style.setProperty(property,'calc('+raw+' * var(--kona-ui-scale,1))',node.style.getPropertyPriority(property));}if(node.namespaceURI==='http://www.w3.org/2000/svg'&&node.hasAttribute('font-size')&&!node.style.fontSize){const size=node.getAttribute('font-size');if(/^\d+(\.\d+)?(px)?$/.test(size))node.style.fontSize='calc('+parseFloat(size)+'px * var(--kona-ui-scale,1))'}}
 function scan(root){scaleNode(root);root.querySelectorAll?.('[style],[font-size]').forEach(scaleNode)}
 scan(document.documentElement);new MutationObserver(changes=>{for(const m of changes){if(m.type==='attributes')scaleNode(m.target);else for(const n of m.addedNodes)if(n.nodeType===1)scan(n)}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','font-size']});
 const dock=document.getElementById('dock');if(dock&&typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>document.documentElement.style.setProperty('--dock-h',dock.getBoundingClientRect().height+'px')).observe(dock)}
})();
