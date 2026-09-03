const times=["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];
const supabaseClient = window.supabase.createClient(
  window.DUBU_CONFIG.SUPABASE_URL,
  window.DUBU_CONFIG.SUPABASE_PUBLISHABLE_KEY
);
let currentUser=null, bookings=[], notifications=[];

const $=id=>document.getElementById(id);
const today=new Date().toISOString().slice(0,10);
$("date").value=today; $("scheduleDate").value=today;
$("time").innerHTML='<option value="">เลือกเวลา</option>'+times.map(t=>`<option>${t}</option>`).join("");

function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2500)}
function msg(t){$("loginMsg").textContent=t}

async function loadData(){
  if(!currentUser)return;
  const {data,error}=await supabaseClient.from("bookings").select("*").order("date",{ascending:true}).order("time",{ascending:true});
  if(error){toast("โหลดข้อมูลไม่สำเร็จ: "+error.message);return}
  bookings=data||[];
  renderSchedule();renderCustomers();renderNotifications();
}
function renderSchedule(){
 const d=$("scheduleDate").value, day=bookings.filter(b=>b.date===d);
 $("schedule").innerHTML=times.map(t=>{const b=day.find(x=>x.time===t);return `<div class="slot"><span class="time">${t}</span>${b?`<span><b>${esc(b.customer_name)}</b></span><span class="busy">ไม่ว่าง</span>`:`<span class="free">ว่าง</span>`}</div>`}).join("");
}
function renderCustomers(){
 const q=$("search").value.trim().toLowerCase();
 const seen=new Map();
 bookings.forEach(b=>seen.set(b.phone||b.customer_name,b));
 const list=[...seen.values()].filter(b=>(b.customer_name+" "+(b.phone||"")).toLowerCase().includes(q));
 $("customerCount").textContent=`${list.length} คน`;
 $("customers").innerHTML=list.length?list.map(b=>`<div class="customer"><div><b>${esc(b.customer_name)}</b><div class="muted">${esc(b.phone||"-")}</div></div><div class="muted">${b.date} ${b.time}</div></div>`).join(""):'<p class="empty">ยังไม่มีข้อมูลลูกค้า</p>';
}
function renderNotifications(){
 $("badge").textContent=notifications.length;
 $("notifications").innerHTML=notifications.length?notifications.slice().reverse().map(n=>`<div class="notice"><b>${esc(n.title)}</b><br>${esc(n.text)}<div class="muted">${new Date(n.created_at).toLocaleString("th-TH")}</div></div>`).join(""):'<p class="empty">ยังไม่มีแจ้งเตือน</p>';
}
async function createBooking(){
 const name=$("name").value.trim(),phone=$("phone").value.trim(),date=$("date").value,time=$("time").value,note=$("note").value.trim();
 if(!name||!date||!time)return toast("กรุณากรอกชื่อ วันที่ และเวลา");
 if(bookings.some(b=>b.date===date&&b.time===time))return toast("เวลานี้มีคิวแล้ว ❌");
 const {error}=await supabaseClient.from("bookings").insert({user_id:currentUser.id,customer_name:name,phone,date,time,note});
 if(error)return toast("บันทึกไม่สำเร็จ: "+error.message);
 await supabaseClient.from("notifications").insert({user_id:currentUser.id,title:"มีคิวใหม่ 🎉",text:`${name} • ${date} • ${time}`});
 $("name").value="";$("phone").value="";$("time").value="";$("note").value="";
 toast("ลงคิวเรียบร้อยแล้ว ✓"); await loadData();
}
async function login(){
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||!password)return msg("กรอกอีเมลและรหัสผ่านก่อน");
 const {error}=await supabaseClient.auth.signInWithPassword({email,password});
 if(error)return msg("เข้าสู่ระบบไม่สำเร็จ: "+error.message);
}
async function signup(){
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<6)return msg("กรอกอีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร");
 const {error}=await supabaseClient.auth.signUp({email,password});
 if(error)return msg("สมัครไม่สำเร็จ: "+error.message);
 msg("สมัครสำเร็จ หากระบบขอให้ยืนยันอีเมล ให้กดยืนยันก่อนเข้าสู่ระบบ");
}
async function start(){
 const {data}=await supabaseClient.auth.getSession();
 if(data.session) showApp(data.session.user);
 supabaseClient.auth.onAuthStateChange((_event,session)=>session?showApp(session.user):showLogin());
}
async function showApp(user){
 currentUser=user;$("login").classList.add("hidden");$("app").classList.remove("hidden");
 await loadData();
}
function showLogin(){currentUser=null;$("app").classList.add("hidden");$("login").classList.remove("hidden")}
$("loginBtn").onclick=login;$("signupBtn").onclick=signup;$("add").onclick=createBooking;
$("scheduleDate").onchange=renderSchedule;$("search").oninput=renderCustomers;
$("notifyBtn").onclick=()=>{$("panel").classList.toggle("hidden");renderNotifications()};
$("close").onclick=()=>$("panel").classList.add("hidden");
$("logoutBtn").onclick=async()=>{await supabaseClient.auth.signOut();showLogin()};
start();
