let supabaseClient=null;
function setLoginMsg(t){const el=$("loginMsg");if(el){el.textContent=t;el.style.display="block"}}
try{
  if(!window.supabase) throw new Error("ไม่พบ Supabase library");
  if(!window.DUBU_CONFIG?.SUPABASE_URL||!window.DUBU_CONFIG?.SUPABASE_PUBLISHABLE_KEY) throw new Error("ไม่พบการตั้งค่า Supabase");
  supabaseClient=window.supabase.createClient(DUBU_CONFIG.SUPABASE_URL,DUBU_CONFIG.SUPABASE_PUBLISHABLE_KEY);
}catch(e){
  console.error("DUBU init error",e);
}
let currentUser=null,bookings=[],customers=[],services=[],range="day",statusFilter="all",selectedDate=localISO(),viewMonth=new Date();
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function localISO(d=new Date()){const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)}
function baht(n){return "฿"+Number(n||0).toLocaleString("th-TH")}
function toast(t){$("toast").textContent=t;$("toast").style.display="block";clearTimeout(window.tt);window.tt=setTimeout(()=>$("toast").style.display="none",2500)}
function fmtDate(d){return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"})}
function fmtShort(d){return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short"})}
function timeToMin(t){const [h,m]=t.split(":").map(Number);return h*60+m}
const times=Array.from({length:48},(_,i)=>`${String(Math.floor(i/2)).padStart(2,"0")}:${i%2?"30":"00"}`);
function showPage(p){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("page-"+p).classList.remove("hidden");document.querySelectorAll(".bottom-nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===p));if(p==="calendar")renderCalendar();if(p==="queue")renderQueue();if(p==="customers")renderCustomers();if(p==="revenue")renderRevenue();window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function openModal(html){$("modalContent").innerHTML=html;$("modal").classList.remove("hidden")}
$("modalClose").onclick=()=>$("modal").classList.add("hidden");
function closeModal(){$("modal").classList.add("hidden")}
function todayBookings(){return bookings.filter(b=>b.date===localISO())}
function statusLabel(s){return {waiting:"รอคิว",doing:"กำลังดูดวง",done:"ดูเสร็จแล้ว",cancelled:"ยกเลิก"}[s||"waiting"]}
function paymentLabel(p){return p==="paid"?"ชำระแล้ว":"ยังไม่ชำระ"}
function serviceName(b){return b.service_name||services.find(s=>s.id===b.service_id)?.name||"ดูดวงทั่วไป"}
function priceOf(b){return Number(b.price??services.find(s=>s.id===b.service_id)?.price??300)}
async function loadData(){
  let q=supabaseClient.from("bookings").select("*").order("date",{ascending:true}).order("time",{ascending:true});
  const r=await q;if(r.error){toast("โหลดคิวไม่สำเร็จ: "+r.error.message);return} bookings=r.data||[];
  const c=await supabaseClient.from("customers").select("*").order("name"); customers=c.data||[];
  const s=await supabaseClient.from("services").select("*").order("name"); services=s.data||[];
  if(!services.length){services=[{id:"local",name:"ดูดวงทั่วไป",price:300,duration:60}];}
  renderHome();renderCalendar();renderQueue();renderCustomers();renderRevenue();
}
function renderHome(){
  const day=todayBookings(), done=day.filter(b=>b.status==="done"&&b.payment_status==="paid").reduce((a,b)=>a+priceOf(b),0), paid=day.filter(b=>b.payment_status==="paid").reduce((a,b)=>a+priceOf(b),0);
  $("todayLabel").textContent=fmtDate(localISO());$("homeCount").textContent=day.length;$("homeRevenue").textContent=baht(done);$("homePaid").textContent="ชำระแล้ว "+baht(paid);
  const now=new Date(), next=day.filter(b=>b.status!=="done"&&b.status!=="cancelled"&&timeToMin(b.time)>=now.getHours()*60+now.getMinutes()).sort((a,b)=>timeToMin(a.time)-timeToMin(b.time))[0];
  $("homeNext").textContent=next?.time||"—";$("homeNextName").textContent=next?next.customer_name:"ยังไม่มีคิว";
  const soon=day.filter(b=>b.status!=="done"&&b.status!=="cancelled"&&Math.abs(timeToMin(b.time)-(now.getHours()*60+now.getMinutes()))<=30).sort((a,b)=>timeToMin(a.time)-timeToMin(b.time));
  $("homeAlerts").innerHTML=soon.length?soon.map(b=>`<div class="notice">🔔 <b>${b.time} ${esc(b.customer_name)}</b> · ${esc(serviceName(b))}<div class="muted">อีกประมาณ ${Math.max(0,timeToMin(b.time)-(now.getHours()*60+now.getMinutes()))} นาที</div></div>`).join(""):'<div class="muted">ยังไม่มีคิวที่ใกล้ถึงเวลา 🎉</div>';
  $("homeQueue").innerHTML=day.length?day.map(queueCard).join(""):'<div class="muted">วันนี้ยังไม่มีคิว · กด “เพิ่มคิว” เพื่อเริ่มต้น 🔮</div>';
}
function queueCard(b){
 const action=b.status==="waiting"?`<button class="action-btn start" onclick="event.stopPropagation();startBooking('${b.id}')">▶ เริ่มดูดวง</button>`:b.status==="doing"?`<button class="action-btn finish" onclick="event.stopPropagation();finishBooking('${b.id}')">✓ ดูเสร็จแล้ว</button>`:"";
 return `<div class="queue-item" onclick="openBooking('${b.id}')"><div class="qtime">${b.time}</div><div class="qmain"><b>${esc(b.customer_name)}</b><span class="muted">${esc(serviceName(b))} · ${baht(priceOf(b))}</span></div><div class="actions"><span class="badge ${b.status==="done"?"done":b.status==="doing"?"doing":b.status==="cancelled"?"cancel":"wait"}">${statusLabel(b.status)}</span> <span class="badge ${b.payment_status==="paid"?"paid":"unpaid"}">${paymentLabel(b.payment_status)}</span>${action}</div></div>`
}
function renderCalendar(){
 const y=viewMonth.getFullYear(),m=viewMonth.getMonth();$("monthTitle").textContent=new Date(y,m,1).toLocaleDateString("th-TH",{month:"long",year:"numeric"});
 const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();let html="";
 for(let i=0;i<42;i++){const n=i-first+1;let d,cls="";if(n<1){d=localISO(new Date(y,m-1,prevDays+n));cls="other"}else if(n>days){d=localISO(new Date(y,m,n));cls="other"}else d=localISO(new Date(y,m,n));const count=bookings.filter(b=>b.date===d&&b.status!=="cancelled").length;if(d===selectedDate)cls+=" selected";if(d===localISO())cls+=" today";html+=`<button class="${cls}" data-date="${d}"><span class="daynum">${new Date(d+"T00:00:00").getDate()}</span>${count?`<span class="daycount">🔮 ${count}</span>`:""}</button>`}
 $("calendarGrid").innerHTML=html;document.querySelectorAll("#calendarGrid button").forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderCalendar();renderSlots()});renderSlots();
}
function renderSlots(){
 $("selectedDateTitle").textContent=fmtDate(selectedDate);const day=bookings.filter(b=>b.date===selectedDate&&b.status!=="cancelled");$("slots").innerHTML=times.map(t=>{const b=day.find(x=>x.time===t);return `<div class="slot"><span class="slot-time">${t}</span>${b?`<span><b>${esc(b.customer_name)}</b><div class="muted">${esc(serviceName(b))}</div></span><button class="badge busy" onclick="openBooking('${b.id}')">ไม่ว่าง · ดูคิว</button>`:`<span class="muted">เวลาว่าง</span><button class="badge free" onclick="openAdd('${selectedDate}','${t}')">ว่าง · เพิ่มคิว</button>`}</div>`}).join("");
}
$("prevMonth").onclick=()=>{viewMonth.setMonth(viewMonth.getMonth()-1);renderCalendar()};$("nextMonth").onclick=()=>{viewMonth.setMonth(viewMonth.getMonth()+1);renderCalendar()};
$("freeOnlyBtn").onclick=()=>{const day=bookings.filter(b=>b.date===selectedDate&&b.status!=="cancelled");const free=times.filter(t=>!day.some(b=>b.time===t));openModal(`<h2>🔮 เวลาว่าง ${fmtShort(selectedDate)}</h2><p class="muted">ส่งหน้านี้ให้ลูกค้าเลือกเวลาได้</p><div>${free.map(t=>`<span class="badge free" style="margin:4px">${t}</span>`).join("")||"ไม่มีเวลาว่าง"}</div>`)}

function buildScheduleText(date){
 const day=bookings.filter(b=>b.date===date&&b.status!=="cancelled");
 const busy=new Set(day.map(b=>b.time));
 const rows=[];
 for(let i=0;i<times.length;i+=2){
   const a=times[i],b=times[i+1];
   rows.push(`${a} ${busy.has(a)?"🔴":"🟢"}  |  ${b} ${busy.has(b)?"🔴":"🟢"}`);
 }
 return `🔮 DUBU ตารางคิว\n📅 ${fmtDate(date)}\n🟢 ว่าง   🔴 ไม่ว่าง\n\n${rows.join("\\n")}`;
}
function openScheduleShare(date=selectedDate){
 const day=bookings.filter(b=>b.date===date&&b.status!=="cancelled");
 const busy=new Set(day.map(b=>b.time));
 const grid=times.map(t=>`<div class="share-slot ${busy.has(t)?"busy":"free"}"><b>${t}</b><span>${busy.has(t)?"🔴 ไม่ว่าง":"🟢 ว่าง"}</span></div>`).join("");
 openModal(`<h2>📤 ตารางสำหรับส่งลูกค้า</h2><p class="muted">${fmtDate(date)}</p><div class="share-legend"><span class="badge free">🟢 ว่าง</span><span class="badge busy">🔴 ไม่ว่าง</span></div><div class="share-summary-grid">${grid}</div><p class="share-note">แสดงเฉพาะเวลาและสถานะ ไม่แสดงข้อมูลลูกค้า</p><div class="modal-actions"><button id="copyScheduleBtn" class="secondary">📋 คัดลอกข้อความ</button><button id="nativeShareBtn" class="primary">📤 แชร์ให้ลูกค้า</button></div>`);
 $("copyScheduleBtn").onclick=()=>copyScheduleText(date);
 $("nativeShareBtn").onclick=()=>shareScheduleText(date);
}
async function copyScheduleText(date=selectedDate){
 const text=buildScheduleText(date);
 try{
   await navigator.clipboard.writeText(text);
   toast("คัดลอกตารางแล้ว ✓");
 }catch(e){
   openModal(`<h2>📋 ข้อความตารางคิว</h2><textarea class="share-textarea" readonly>${esc(text)}</textarea><p class="muted">กดค้างที่ข้อความเพื่อคัดลอก</p>`);
 }
}
async function shareScheduleText(date=selectedDate){
 const text=buildScheduleText(date);
 if(navigator.share){
   try{await navigator.share({title:"DUBU ตารางคิว",text});}catch(e){}
 }else{
   await copyScheduleText(date);
 }
}
$("shareScheduleBtn").onclick=()=>openScheduleShare(selectedDate);

function renderQueue(){
 $("queueDate").value=selectedDate;const day=bookings.filter(b=>b.date===selectedDate&&b.status!=="cancelled").sort((a,b)=>timeToMin(a.time)-timeToMin(b.time));const counts={waiting:0,doing:0,done:0};day.forEach(b=>counts[b.status||"waiting"]++);
 $("queueSummary").innerHTML=`<span class="summary-pill">ทั้งหมด ${day.length}</span><span class="summary-pill">รอคิว ${counts.waiting}</span><span class="summary-pill">กำลังดู ${counts.doing}</span><span class="summary-pill">เสร็จแล้ว ${counts.done}</span><span class="summary-pill">รายรับ ${baht(day.filter(b=>b.payment_status==="paid").reduce((a,b)=>a+priceOf(b),0))}</span>`;
 $("statusChips").innerHTML=[["all","ทั้งหมด"],["waiting","รอคิว"],["doing","กำลังดู"],["done","ดูเสร็จแล้ว"],["cancelled","ยกเลิก"]].map(x=>`<button class="chip ${statusFilter===x[0]?"active":""}" onclick="statusFilter='${x[0]}';renderQueue()">${x[1]}</button>`).join("");
 const list=statusFilter==="all"?day:bookings.filter(b=>b.date===selectedDate&&b.status===statusFilter).sort((a,b)=>timeToMin(a.time)-timeToMin(b.time));
 $("queueList").innerHTML=list.length?list.map(b=>`<div class="queue-item" onclick="openBooking('${b.id}')"><div class="qtime">${b.time}</div><div class="qmain"><b>${esc(b.customer_name)}</b><span class="muted">${esc(serviceName(b))} · ${baht(priceOf(b))}</span></div><div class="actions"><span class="badge ${b.status==="done"?"done":b.status==="doing"?"doing":"wait"}">${statusLabel(b.status)}</span><span class="badge ${b.payment_status==="paid"?"paid":"unpaid"}">${paymentLabel(b.payment_status)}</span></div></div>`).join(""):'<div class="muted">ไม่มีคิวในวันนี้</div>';
}
$("queueDate").onchange=e=>{selectedDate=e.target.value;renderQueue();};$("queuePrev").onclick=()=>shiftQueue(-1);$("queueNext").onclick=()=>shiftQueue(1);
function shiftQueue(n){const d=new Date(selectedDate+"T00:00:00");d.setDate(d.getDate()+n);selectedDate=localISO(d);renderQueue()}
function renderCustomers(){
 const q=($("customerSearch").value||"").toLowerCase();const list=customers.filter(c=>(c.name+" "+(c.phone||"")).toLowerCase().includes(q));$("customerCount").textContent=`${list.length} คน`;
 $("customerList").innerHTML=list.length?list.map(c=>{const hist=bookings.filter(b=>b.customer_id===c.id||b.phone===c.phone||b.customer_name===c.name).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));return `<div class="customer-item" onclick="openCustomer('${c.id}')"><div><b>${esc(c.name)}</b><span class="muted">${esc(c.phone||"-")}</span></div><div style="text-align:right"><b>${hist.length} ครั้ง</b><div class="muted">ล่าสุด ${hist[0]?fmtShort(hist[0].date):"-"}</div></div></div>`}).join(""):'<div class="muted">ยังไม่มีลูกค้า</div>';
}
$("customerSearch").oninput=renderCustomers;
function renderRevenue(){
 const now=new Date(),today=localISO(),from=range==="day"?today:range==="week"?localISO(new Date(now-6*864e5)):range==="month"?localISO(new Date(now.getFullYear(),now.getMonth(),1)):"0000-01-01";
 const list=bookings.filter(b=>b.date>=from&&b.date<=today&&b.status!=="cancelled");const total=list.reduce((a,b)=>a+priceOf(b),0),paid=list.filter(b=>b.payment_status==="paid").reduce((a,b)=>a+priceOf(b),0);
 $("revTotal").textContent=baht(total);$("revPaid").textContent=baht(paid);$("revUnpaid").textContent=baht(total-paid);$("revCount").textContent=list.length;
 const map={};list.forEach(b=>map[b.date]=(map[b.date]||0)+(b.payment_status==="paid"?priceOf(b):0));$("revenueDays").innerHTML=Object.keys(map).sort().reverse().map(d=>`<div class="revenue-row"><b>${fmtShort(d)}</b><strong>${baht(map[d])}</strong></div>`).join("")||'<div class="muted">ยังไม่มีรายรับในช่วงนี้</div>';
 document.querySelectorAll(".revenue-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.range===range));
}
document.querySelectorAll(".revenue-tabs button").forEach(b=>b.onclick=()=>{range=b.dataset.range;renderRevenue()});
function openAdd(date=selectedDate,time=""){
 const serviceOpts=services.map(s=>`<option value="${s.id}">${esc(s.name)} · ${baht(s.price)} · ${s.duration||60} นาที</option>`).join("");
 const defaultPrice=services[0]?.price??300;
 openModal(`<h2>＋ เพิ่มคิว</h2><div class="form-grid"><label>ชื่อลูกค้า<input id="fName" placeholder="เช่น คุณเมย์"></label><label>ช่องทางการติดต่อ<input id="fPhone" placeholder="เช่น LINE / Facebook / 08xxxxxxxx"></label><label>วันที่<input id="fDate" type="date" value="${date}"></label><label>เวลา<select id="fTime"><option value="">เลือกเวลา</option>${times.map(t=>`<option ${t===time?"selected":""}>${t}</option>`).join("")}</select></label><label>บริการ<select id="fService" onchange="syncPrice()">${serviceOpts}</select></label><label>ราคา (บาท)<input id="fPrice" type="number" min="0" step="1" value="${defaultPrice}" placeholder="เช่น 300"></label><label>สถานะการชำระ<select id="fPay"><option value="unpaid">ยังไม่ชำระ</option><option value="paid">ชำระแล้ว</option></select></label><textarea id="fNote" placeholder="หมายเหตุ"></textarea></div><div class="modal-actions"><button class="primary" onclick="saveBooking()">ลงคิว</button></div>`)
}
function syncPrice(){const s=services.find(x=>String(x.id)===String($("fService").value));if(s&&$("fPrice"))$("fPrice").value=s.price??0}

function findCustomer(name,phone){return customers.find(c=>(phone&&c.phone===phone)||c.name===name)}
async function saveBooking(){
 const name=$("fName").value.trim(),phone=$("fPhone").value.trim(),date=$("fDate").value,time=$("fTime").value,sid=$("fService").value,note=$("fNote").value.trim(),pay=$("fPay").value,price=Number($("fPrice").value||0);
 if(!name||!date||!time)return toast("กรุณากรอกชื่อ วันที่ และเวลา");
 if(price<0)return toast("ราคาต้องไม่ติดลบ");
 if(bookings.some(b=>b.date===date&&b.time===time&&b.status!=="cancelled"))return toast("เวลานี้มีคิวแล้ว ❌");
 let c=findCustomer(name,phone);if(!c){const r=await supabaseClient.from("customers").insert({user_id:currentUser.id,name,phone}).select().single();if(r.error)return toast("เพิ่มลูกค้าไม่สำเร็จ: "+r.error.message);c=r.data}
 const s=services.find(x=>String(x.id)===String(sid));const row={user_id:currentUser.id,customer_id:c.id,customer_name:name,phone,date,time,note,status:"waiting",payment_status:pay,service_id:s?.id==="local"?null:s?.id,service_name:s?.name||"ดูดวงทั่วไป",price};
 const r=await supabaseClient.from("bookings").insert(row);if(r.error)return toast("ลงคิวไม่สำเร็จ: "+r.error.message);toast("ลงคิวเรียบร้อยแล้ว ✓");closeModal();await loadData();
}

function openBooking(id){
 const b=bookings.find(x=>String(x.id)===String(id));if(!b)return;
 const primary=b.status==="waiting"?`<button class="primary" onclick="startBooking('${b.id}')">▶ เริ่มดูดวง</button>`:b.status==="doing"?`<button class="primary finish-main" onclick="finishBooking('${b.id}')">✓ ดูเสร็จแล้ว</button>`:"";
 openModal(`<h2>🔮 รายละเอียดคิว</h2><div class="notice"><b>${esc(b.customer_name)}</b><br>${fmtDate(b.date)} · ${b.time}<br>${esc(serviceName(b))} · ${baht(priceOf(b))}<br><span class="muted">ช่องทางการติดต่อ: ${esc(b.phone||"-")}</span></div><div class="quick-actions">${primary}</div><div class="form-grid"><label>สถานะ<select id="editStatus"><option value="waiting" ${b.status==="waiting"?"selected":""}>รอคิว</option><option value="doing" ${b.status==="doing"?"selected":""}>กำลังดูดวง</option><option value="done" ${b.status==="done"?"selected":""}>ดูเสร็จแล้ว</option><option value="cancelled" ${b.status==="cancelled"?"selected":""}>ยกเลิก</option></select></label><label>การชำระเงิน<select id="editPay"><option value="unpaid" ${b.payment_status!=="paid"?"selected":""}>ยังไม่ชำระ</option><option value="paid" ${b.payment_status==="paid"?"selected":""}>ชำระแล้ว</option></select></label><label>ราคา<input id="editPrice" type="number" min="0" value="${priceOf(b)}"></label><textarea id="editNote">${esc(b.note||"")}</textarea></div><div class="modal-actions"><button class="secondary" onclick="updateBooking('${b.id}')">บันทึกการแก้ไข</button><button class="danger" onclick="deleteBooking('${b.id}')">ลบคิว</button></div>`)
}
async function startBooking(id){
 const r=await supabaseClient.from("bookings").update({status:"doing"}).eq("id",id);if(r.error)return toast("เริ่มดูดวงไม่สำเร็จ: "+r.error.message);toast("เริ่มดูดวงแล้ว 🔮");closeModal();await loadData()
}
async function finishBooking(id){
 const b=bookings.find(x=>String(x.id)===String(id));if(!b)return;
 const r=await supabaseClient.from("bookings").update({status:"done",payment_status:"paid"}).eq("id",id);if(r.error)return toast("บันทึกการดูเสร็จไม่สำเร็จ: "+r.error.message);toast(`ดูเสร็จแล้ว ✓ ยอด ${baht(priceOf(b))} เข้ารายรับแล้ว`);closeModal();await loadData()
}
async function updateBooking(id){
 const status=$("editStatus").value,payment_status=$("editPay").value,price=Number($("editPrice").value||0),note=$("editNote").value;
 const payload={status,payment_status,price,note};
 if(status==="done")payload.payment_status="paid";
 const r=await supabaseClient.from("bookings").update(payload).eq("id",id);if(r.error)return toast("แก้ไขไม่สำเร็จ: "+r.error.message);toast(status==="done"?`ดูเสร็จแล้ว ✓ ยอด ${baht(price)} เข้ารายรับแล้ว`:"บันทึกแล้ว ✓");closeModal();await loadData()
}

async function deleteBooking(id){if(!confirm("ลบคิวนี้ใช่ไหม?"))return;const r=await supabaseClient.from("bookings").delete().eq("id",id);if(r.error)return toast("ลบไม่สำเร็จ: "+r.error.message);toast("ลบคิวแล้ว");closeModal();await loadData()}
function openCustomer(id){const c=customers.find(x=>String(x.id)===String(id));if(!c)return;const hist=bookings.filter(b=>b.customer_id===c.id||b.phone===c.phone||b.customer_name===c.name).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));openModal(`<h2>👤 ${esc(c.name)}</h2><p class="muted">ช่องทางการติดต่อ: ${esc(c.phone||"-")}</p><div class="queue-summary"><span class="summary-pill">มาทั้งหมด ${hist.length} ครั้ง</span><span class="summary-pill">ล่าสุด ${hist[0]?fmtDate(hist[0].date):"-"}</span><span class="summary-pill">ใช้บริการ ${baht(hist.reduce((a,b)=>a+priceOf(b),0))}</span></div><h3>🔮 ประวัติการดูดวง</h3>${hist.map(b=>`<div class="revenue-row"><span>${fmtShort(b.date)} · ${esc(serviceName(b))}</span><b>${baht(priceOf(b))}</b></div>`).join("")||'<div class="muted">ยังไม่มีประวัติ</div>'}`)}
$("addCustomerBtn").onclick=()=>openModal(`<h2>＋ เพิ่มลูกค้า</h2><div class="form-grid"><label>ชื่อ<input id="cName"></label><label>ช่องทางการติดต่อ<input id="cPhone" placeholder="เช่น LINE / Facebook / 08xxxxxxxx"></label><textarea id="cNote" placeholder="หมายเหตุ"></textarea></div><div class="modal-actions"><button class="primary" onclick="saveCustomer()">บันทึก</button></div>`);
async function saveCustomer(){const name=$("cName").value.trim(),phone=$("cPhone").value.trim(),note=$("cNote").value.trim();if(!name)return toast("กรุณากรอกชื่อ");const r=await supabaseClient.from("customers").insert({user_id:currentUser.id,name,phone,note});if(r.error)return toast("บันทึกไม่สำเร็จ: "+r.error.message);toast("เพิ่มลูกค้าแล้ว ✓");closeModal();await loadData()}
document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>openAdd());
$("notifyBtn").onclick=()=>{$("panel").classList.toggle("hidden");renderNotifications()};$("panelClose").onclick=()=>$("panel").classList.add("hidden");
function renderNotifications(){const day=todayBookings().filter(b=>b.status!=="done"&&b.status!=="cancelled");$("badge").textContent=day.length;$("notifications").innerHTML=day.length?day.map(b=>`<div class="notice">🔔 <b>${b.time} ${esc(b.customer_name)}</b><br>${esc(serviceName(b))} · ${baht(priceOf(b))}</div>`).join(""):'<div class="muted">ไม่มีแจ้งเตือน</div>'}
$("settingsBtn").onclick=()=>openModal(`<h2>⚙️ ตั้งค่า</h2><div class="notice">บัญชี: ${esc(currentUser?.email||"-")}</div><h3>🔮 บริการ</h3><div class="muted">จัดการบริการและราคาได้จากฐานข้อมูลของ DUBU</div><h3>⏰ เวลา</h3><div class="muted">ระบบเปิดให้ลงคิวได้ตลอด 24 ชั่วโมง และตารางจะแสดงทุก 30 นาที</div><div class="modal-actions"><button class="danger" onclick="supabaseClient.auth.signOut()">ออกจากระบบ</button></div>`);
$("loginBtn").onclick=async()=>{
  const email=$("email").value.trim(),password=$("password").value;
  setLoginMsg("");
  if(!supabaseClient)return setLoginMsg("ระบบยังโหลดไม่ครบ กรุณารีโหลดหน้าเว็บอีกครั้ง");
  if(!email||!password)return setLoginMsg("กรุณากรอกอีเมลและรหัสผ่าน");
  const btn=$("loginBtn");btn.disabled=true;btn.textContent="กำลังเข้าสู่ระบบ...";
  try{
    const r=await supabaseClient.auth.signInWithPassword({email,password});
    if(r.error)setLoginMsg("เข้าสู่ระบบไม่สำเร็จ: "+r.error.message);
  }catch(e){setLoginMsg("เชื่อมต่อระบบไม่ได้: "+(e?.message||e));}
  finally{btn.disabled=false;btn.textContent="เข้าสู่ระบบ";}
};
$("signupBtn").onclick=async()=>{
  const email=$("email").value.trim(),password=$("password").value;
  if(!supabaseClient)return setLoginMsg("ระบบยังโหลดไม่ครบ กรุณารีโหลดหน้าเว็บอีกครั้ง");
  if(password.length<6)return setLoginMsg("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
  try{const r=await supabaseClient.auth.signUp({email,password});setLoginMsg(r.error?r.error.message:"สมัครสำเร็จแล้ว")}catch(e){setLoginMsg(e?.message||String(e))}
};
if(publicMode){
  if(supabaseClient)initPublicSchedule();
  else {$("publicSchedule").classList.remove("hidden");$("login").classList.add("hidden");$("app").classList.add("hidden");$("publicMsg").textContent="ระบบยังโหลดไม่ครบ กรุณารีโหลดหน้าเว็บอีกครั้ง";}
}else if(supabaseClient){
  supabaseClient.auth.onAuthStateChange((e,s)=>s?showApp(s.user):showLogin());
}else{
  showLogin();
  setLoginMsg("ระบบยังโหลดไม่ครบ กรุณารีโหลดหน้าเว็บอีกครั้ง");
}
async function showApp(u){currentUser=u;$("login").classList.add("hidden");$("app").classList.remove("hidden");await loadData()}
function showLogin(){currentUser=null;$("app").classList.add("hidden");$("login").classList.remove("hidden")}
showLogin();
