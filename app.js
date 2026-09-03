const times=["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
let bookings=JSON.parse(localStorage.getItem("dubu_bookings")||"[]");
let notifications=JSON.parse(localStorage.getItem("dubu_notifications")||"[]");
const $=id=>document.getElementById(id);
const today=new Date().toISOString().slice(0,10);
$("date").value=today;$("scheduleDate").value=today;
$("time").innerHTML='<option value="">เลือกเวลา</option>'+times.map(t=>`<option>${t}</option>`).join("");

function save(){localStorage.setItem("dubu_bookings",JSON.stringify(bookings));localStorage.setItem("dubu_notifications",JSON.stringify(notifications))}
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2500)}
function renderSchedule(){
 const d=$("scheduleDate").value; const day=bookings.filter(b=>b.date===d);
 $("schedule").innerHTML=times.map(t=>{const b=day.find(x=>x.time===t);return `<div class="slot"><span class="time">${t}</span>${b?`<span><b>${esc(b.name)}</b></span><span class="busy">ไม่ว่าง</span>`:`<span class="free">ว่าง</span>`}</div>`}).join("");
}
function renderCustomers(){
 const q=$("search").value.trim().toLowerCase();
 const names=[...new Map(bookings.map(b=>[b.phone||b.name,b])).values()].filter(b=>(b.name+" "+b.phone).toLowerCase().includes(q));
 $("customerCount").textContent=`${names.length} คน`;
 $("customers").innerHTML=names.length?names.map(b=>`<div class="customer"><div><b>${esc(b.name)}</b><div class="muted">${esc(b.phone||"-")}</div></div><div class="muted">${b.date} ${b.time}</div></div>`).join(""):'<p class="empty">ยังไม่มีข้อมูลลูกค้า</p>';
}
function renderNotices(){
 $("badge").textContent=notifications.length;
 $("notifications").innerHTML=notifications.length?notifications.slice().reverse().map(n=>`<div class="notice"><b>${esc(n.title)}</b><br>${esc(n.text)}<div class="muted">${new Date(n.at).toLocaleString("th-TH")}</div></div>`).join(""):'<p class="empty">ยังไม่มีแจ้งเตือน</p>';
}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
$("add").onclick=()=>{
 const name=$("name").value.trim(),phone=$("phone").value.trim(),date=$("date").value,time=$("time").value;
 if(!name||!date||!time)return toast("กรุณากรอกชื่อ วันที่ และเวลา");
 if(bookings.some(b=>b.date===date&&b.time===time))return toast("เวลานี้มีคิวแล้ว ❌");
 bookings.push({id:Date.now(),name,phone,date,time,note:$("note").value.trim()});
 notifications.push({title:"มีคิวใหม่ 🎉",text:`${name} • ${date} • ${time}`,at:new Date().toISOString()});
 save();renderSchedule();renderCustomers();renderNotices();toast("ลงคิวเรียบร้อยแล้ว ✓");
 $("name").value="";$("phone").value="";$("time").value="";$("note").value="";
};
$("scheduleDate").onchange=renderSchedule;$("search").oninput=renderCustomers;
$("bell").onclick=()=>{$("panel").classList.toggle("hidden");renderNotices()};
$("close").onclick=()=>$("panel").classList.add("hidden");
renderSchedule();renderCustomers();renderNotices();
