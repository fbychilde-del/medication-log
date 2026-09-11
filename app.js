'use strict';
const $ = id => document.getElementById(id);
let db, medicines = [], records = [], editing = null, installEvent, messageTimer;
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('medication-log') : null;
const uid = () => crypto.randomUUID();
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tell(message) { $('message').textContent = message; clearTimeout(messageTimer); messageTimer = setTimeout(() => $('message').textContent = '', 5000); }
function fail(error) { console.error(error); tell('操作未完成，数据未确认保存。请重试或导出备份。'); }
function localTime(value = new Date()) {
  const d = new Date(value), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('medication-log', 1);
    request.onupgradeneeded = () => { for (const name of ['medicines', 'records']) request.result.createObjectStore(name, {keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function readAll(store) {
  return new Promise((resolve, reject) => { const req = db.transaction(store).objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function write(stores, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => { channel?.postMessage('changed'); resolve(); };
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    tx.onerror = () => reject(tx.error);
    try { action(tx); } catch (error) { tx.abort(); reject(error); }
  });
}
async function refresh() { [medicines, records] = await Promise.all([readAll('medicines'), readAll('records')]); render(); }
function recent(days) {
  const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-days+1);
  const end = new Date(); end.setHours(24,0,0,0);
  return records.filter(r => r.time >= start.getTime() && r.time < end.getTime());
}
function averageTime(items) {
  let x=0, y=0;
  for (const r of items) { const d=new Date(r.time), a=(d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400*Math.PI*2; x+=Math.cos(a); y+=Math.sin(a); }
  if (!items.length || Math.hypot(x,y)/items.length < .1) return '时间分散，暂无代表值';
  const minutes=(Math.round(((Math.atan2(y,x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*1440))%1440;
  return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
function renderStats() {
  $('totals').innerHTML = [7,30].map(n => `<div class="card">最近 ${n} 天<b>${recent(n).length} 次</b></div>`).join('');
  const range=$('stats-range').value, selected=range==='all'?records:recent(Number(range)), groups=new Map();
  for (const r of selected) { if (!groups.has(r.name)) groups.set(r.name,[]); groups.get(r.name).push(r); }
  $('drug-stats').innerHTML = groups.size ? [...groups].sort((a,b)=>b[1].length-a[1].length).map(([name,items])=>`<article class="card"><strong>${escapeHTML(name)}</strong><p>${items.length} 次 · 平均服药时间：${averageTime(items)}</p></article>`).join('') : '<p class="muted">这个时间范围还没有记录。</p>';
}
function render() {
  $('take').disabled=false;
  $('today').textContent=`今天已记录 ${recent(1).length} 次`;
  $('medicine-list').innerHTML=medicines.map(m=>`<article class="card"><strong>${escapeHTML(m.name)}</strong><p>${escapeHTML(m.dose || '未设置剂量')}</p><button data-remove-medicine="${escapeHTML(m.id)}" class="danger">删除常用药</button></article>`).join('') || '<p class="muted">先添加你常用的药物。</p>';
  $('records').innerHTML=[...records].sort((a,b)=>b.time-a.time).map(r=>`<article class="card"><strong>${escapeHTML(r.name)}${r.dose ? ' · '+escapeHTML(r.dose) : ''}</strong><p><time datetime="${new Date(r.time).toISOString()}">${escapeHTML(new Date(r.time).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}))}</time></p><div class="actions"><button data-edit="${escapeHTML(r.id)}">修改</button><button data-delete="${escapeHTML(r.id)}" class="danger">删除</button></div></article>`).join('') || '<p class="muted">还没有记录。服药后点击上方“已服药”。</p>';
  renderStats();
}
function tab(name) { for (const button of document.querySelectorAll('[data-tab]')) { const active=button.dataset.tab===name; button.setAttribute('aria-pressed',String(active)); $(button.dataset.tab).hidden=!active; } }
function showRecord(record=null) {
  if (!record && !medicines.length) { tab('medicines'); $('medicine-name').focus(); tell('请先添加一种常用药物'); return; }
  editing=record;
  const options=[...medicines];
  if (record && !options.some(m=>m.id===record.medicineId)) options.unshift({id:record.medicineId,name:record.name,dose:record.dose});
  $('record-medicine').innerHTML=options.map(m=>`<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)}${m.dose?' · '+escapeHTML(m.dose):''}</option>`).join('');
  if (record) $('record-medicine').value=record.medicineId;
  $('record-dose').value=record ? record.dose : options[0].dose;
  $('record-time').value=localTime(record ? record.time : new Date());
  $('dialog-title').textContent=record?'修改记录':'记录服药';
  $('record-dialog').showModal();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
$('take').onclick=()=>showRecord();
$('cancel').onclick=()=>$('record-dialog').close();
$('stats-range').onchange=renderStats;
$('record-medicine').onchange=()=>{ $('record-dose').value=medicines.find(m=>m.id===$('record-medicine').value)?.dose ?? editing?.dose ?? ''; };
$('medicine-form').onsubmit=async event=>{
  event.preventDefault(); const name=$('medicine-name').value.trim(), dose=$('medicine-dose').value.trim();
  if (!name) { tell('请输入药名'); return; }
  if (medicines.some(m=>m.name===name && m.dose===dose)) { tell('已经添加过这个药物和剂量'); return; }
  const button=event.submitter; button.disabled=true;
  try { await write(['medicines'],tx=>tx.objectStore('medicines').put({id:uid(),name,dose})); $('medicine-form').reset(); await refresh(); tell('已添加常用药物'); } catch(e) { fail(e); } finally { button.disabled=false; }
};
$('record-form').onsubmit=async event=>{
  event.preventDefault(); const medicineId=$('record-medicine').value;
  const medicine=medicines.find(m=>m.id===medicineId) || (editing && {name:editing.name});
  const time=new Date($('record-time').value).getTime();
  if (!medicine || !Number.isFinite(time)) { tell('请选择药物并填写有效时间'); return; }
  if (time>Date.now()+60000) { tell('服药时间不能在未来'); return; }
  const record={id:editing?.id || uid(),medicineId,name:medicine.name,dose:$('record-dose').value.trim(),time};
  $('save-record').disabled=true;
  try { await write(['records'],tx=>tx.objectStore('records').put(record)); $('record-dialog').close(); await refresh(); tab('history'); tell('已保存服药记录'); if (navigator.storage?.persist) navigator.storage.persist().catch(()=>{}); } catch(e) { fail(e); } finally { $('save-record').disabled=false; }
};
$('records').onclick=async event=>{
  const button=event.target.closest('button'); if(!button) return;
  if(button.dataset.edit) { const record=records.find(r=>r.id===button.dataset.edit); if(record) showRecord(record); return; }
  if(button.dataset.delete && confirm('删除这条服药记录？')) { try { await write(['records'],tx=>tx.objectStore('records').delete(button.dataset.delete)); await refresh(); tell('已删除记录'); } catch(e) { fail(e); } }
};
$('medicine-list').onclick=async event=>{
  const button=event.target.closest('[data-remove-medicine]'); if(!button || !confirm('删除这项常用药物？已有服药记录会保留。')) return;
  try { await write(['medicines'],tx=>tx.objectStore('medicines').delete(button.dataset.removeMedicine)); await refresh(); } catch(e) { fail(e); }
};
$('export').onclick=async()=>{
  try { await refresh(); const url=URL.createObjectURL(new Blob([JSON.stringify({app:'medication-log',version:1,exportedAt:new Date().toISOString(),medicines,records},null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download=`服药记录备份-${localTime().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000); } catch(e) { fail(e); }
};
function validateBackup(data) {
  const str=(v,max)=>typeof v==='string'&&v.length<=max;
  const id=v=>str(v,100)&&v.length>0;
  const base=m=>m&&id(m.id)&&str(m.name,100)&&m.name.trim().length>0&&str(m.dose,100);
  if(data?.app!=='medication-log'||data.version!==1||!Array.isArray(data.medicines)||!Array.isArray(data.records)) throw new Error('Invalid backup');
  if(!data.medicines.every(base)||!data.records.every(r=>base(r)&&id(r.medicineId)&&Number.isFinite(r.time)&&r.time>=0&&r.time<=Date.now()+60000)) throw new Error('Invalid entries');
  for(const list of [data.medicines,data.records]) if(new Set(list.map(i=>i.id)).size!==list.length) throw new Error('Duplicate IDs');
}
$('import').onchange=async event=>{
  const file=event.target.files[0]; if(!file) return;
  try {
    if(file.size>20*1024*1024) throw new Error('File too large');
    const data=JSON.parse(await file.text()); validateBackup(data);
    if(!confirm(`导入 ${data.records.length} 条记录、${data.medicines.length} 项常用药物？相同 ID 保留本机现有内容。`)) return;
    await write(['medicines','records'],tx=>{ for(const key of ['medicines','records']) { const store=tx.objectStore(key); for(const item of data[key]) { const req=store.get(item.id); req.onsuccess=()=>{ if(!req.result) store.put(item); }; } } });
    await refresh(); tell('备份已合并导入');
  } catch(e) { console.error(e); tell('导入失败：请使用本应用导出的有效备份（20 MB 以内）。'); } finally { event.target.value=''; }
};
window.addEventListener('beforeinstallprompt',event=>{ event.preventDefault(); installEvent=event; $('install').hidden=false; });
$('install').onclick=async()=>{ if(installEvent) { await installEvent.prompt(); installEvent=null; $('install').hidden=true; } };
window.addEventListener('appinstalled',()=>{ $('install').hidden=true; });
channel && (channel.onmessage=()=>{ if(db) refresh().catch(fail); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&db) refresh().catch(fail); });
setInterval(()=>{ if(db&&!document.hidden) { $('today').textContent=`今天已记录 ${recent(1).length} 次`; renderStats(); } },60000);
(async()=>{
  try { db=await openDB(); db.onversionchange=()=>db.close(); await refresh(); }
  catch(e) { console.error(e); $('offline-state').textContent='无法打开本地数据库，请使用正常浏览模式并允许本地存储。'; return; }
  if('serviceWorker' in navigator && window.isSecureContext) {
    try { await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready; $('offline-state').textContent='已可离线使用'; }
    catch(e) { console.error(e); $('offline-state').textContent='离线缓存未完成，请联网刷新后重试。'; }
  } else { $('offline-state').textContent='安装与离线功能需要 HTTPS 或电脑 localhost。'; }
})();
