import React, { useEffect, useState } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles.css";

const KEY = "cabaelBoardingDataReact";

const makeRooms = () => Array.from({length:56}, (_,i)=>({
  id:i+1, number:String(i+1).padStart(2,"0"),
  gender:i<20?"Male":i<40?"Female":"Mixed", capacity:5, rent:2500,
  light:i%4!==0, tenants:[]
}));

const initialData = {
  rooms: makeRooms(), tenants: [], payments: [], bookings: [],
  settings:{house:"Cabael Boarding House",address:"Philippines",contact:"",
    admin:"Cabael Admin",email:"admin@cabael.local",adminPassword:"admin123",userEmail:"user@cabael.local",userPassword:"user123"}
};

function loadData(){
  try {
    const raw = localStorage.getItem(KEY);
    if(!raw) return initialData;
    const d = JSON.parse(raw);
    return {...initialData,...d,settings:{...initialData.settings,...(d.settings||{})}};
  } catch { return initialData; }
}
function saveData(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
const money = n => "₱"+Number(n||0).toLocaleString();
const refCode = id => "CB-"+String(id).slice(-6);
const uid = () => Date.now()+Math.floor(Math.random()*1000);

function App(){
  const [data,setData] = useState(loadData);
  const [mode,setMode] = useState("home");
  const [adminAuthed,setAdminAuthed] = useState(sessionStorage.getItem("cabaelAdminAuth")==="1");
  const [customerLogged,setCustomerLogged] = useState(sessionStorage.getItem("cabaelCustomerAuth")==="1");
  const [authRole,setAuthRole] = useState(sessionStorage.getItem("cabaelRole")||"");
  const [dark,setDark] = useState(localStorage.getItem("cabaelDark")==="1");

  useEffect(()=>saveData(data),[data]);
  useEffect(()=>{document.body.classList.toggle("dark-mode",dark); localStorage.setItem("cabaelDark",dark?"1":"0")},[dark]);
  useEffect(()=>{
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
  },[]);

  useEffect(()=>{
    const unsubscribe = onAuthStateChanged(auth, async (user)=>{
      if(!user){
        setCustomerLogged(false);
        setAdminAuthed(false);
        setAuthRole("");
        sessionStorage.removeItem("cabaelRole");
        return;
      }

      try{
        const role = await getUserRole(user);
        saveAuthSession(user, role);
        setAuthRole(role);
        if(role === "admin"){
          setAdminAuthed(true);
          setCustomerLogged(false);
          setMode("admin");
        }else{
          setAdminAuthed(false);
          setCustomerLogged(true);
        }
      }catch(error){
        console.error("Firestore role check failed:", error);
        await signOut(auth).catch(()=>{});
        clearAuthSession();
        setMode("customer");
        alert("Hindi mabasa ang account role sa Firestore. I-check ang Firestore Rules at users/{UID} document.");
      }
    });
    return ()=>unsubscribe();
  },[]);

  const update = fn => setData(prev => { const next = fn(structuredClone(prev)); saveData(next); return next; });

  const logoutAdmin=async()=>{
    await signOut(auth).catch(()=>{});
    clearAuthSession();
    setAdminAuthed(false);
    setCustomerLogged(false);
    setAuthRole("");
    setMode("home");
  };

  const logoutCustomer=async()=>{
    await signOut(auth).catch(()=>{});
    clearAuthSession();
    setCustomerLogged(false);
    setAdminAuthed(false);
    setAuthRole("");
    setMode("customer");
  };

  if(mode==="admin" && adminAuthed && authRole==="admin") return <Admin data={data} update={update} dark={dark} setDark={setDark} onLogout={logoutAdmin} onCustomer={()=>setMode("customer")}/>;
  if(mode==="customer" && !customerLogged) return <CustomerLogin data={data} onLogin={(role)=>{
    if(role==="admin"){ setAdminAuthed(true); setCustomerLogged(false); setAuthRole("admin"); setMode("admin"); }
    else { setAdminAuthed(false); setCustomerLogged(true); setAuthRole("user"); setMode("customer"); }
  }} onHome={()=>setMode("home")}/>;
  if(mode==="customer" && customerLogged && authRole!=="admin") return <Customer data={data} update={update} logged={customerLogged} setLogged={setCustomerLogged} onHome={()=>setMode("home")} onAdmin={()=>setMode("admin")} onLogout={logoutCustomer}/>;
  return <Home data={data} onCustomer={()=>setMode("customer")} dark={dark} setDark={setDark}/>;
}

function saveAuthSession(user, role){
  sessionStorage.setItem("cabaelCustomerAuth", role === "user" ? "1" : "0");
  sessionStorage.setItem("cabaelAdminAuth", role === "admin" ? "1" : "0");
  sessionStorage.setItem("cabaelRole", role);
  sessionStorage.setItem("cabaelCustomerEmail", user.email || "");
  sessionStorage.setItem("cabaelCustomerName", user.displayName || user.email?.split("@")[0] || "Cabael User");
  sessionStorage.setItem("cabaelAdminEmail", user.email || "");
  sessionStorage.setItem("cabaelAdminName", user.displayName || user.email?.split("@")[0] || "Cabael Admin");
}

function clearAuthSession(){
  ["cabaelCustomerAuth","cabaelAdminAuth","cabaelRole","cabaelCustomerEmail","cabaelCustomerName","cabaelAdminEmail","cabaelAdminName"].forEach(k=>sessionStorage.removeItem(k));
}

async function getUserRole(user){
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if(snap.exists()){
    const role = String(snap.data()?.role || "").toLowerCase();
    if(role === "admin" || role === "user") return role;
    throw new Error("Invalid role in Firestore users/{uid}.");
  }

  // New accounts are users by default. Admins must be assigned manually in Firestore.
  await setDoc(userRef, {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Cabael User",
    email: user.email || "",
    role: "user",
    provider: user.providerData?.[0]?.providerId || "unknown",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  return "user";
}

function Brand({small=false}){return <div className={"brand d-flex align-items-center gap-2 "+(small?"brand-small":"")}><div className="brand-icon"><i className="bi bi-house-heart-fill"/></div><div><strong>Cabael</strong><span>Boarding House</span></div></div>}

function Home({data,onCustomer,dark,setDark}){
 return <div className="home-page">
   <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top"><div className="container py-2">
    <Brand/><div className="ms-auto d-flex gap-2"><button className="btn btn-light" onClick={()=>setDark(!dark)}><i className={"bi "+(dark?"bi-sun":"bi-moon")}/></button><button className="btn btn-primary" onClick={onCustomer}>Find a Room</button></div>
   </div></nav>
   <main><section className="hero container mt-4"><div><span className="eyebrow">CABAEL BOARDING HOUSE</span><h1>Comfortable rooms.<br/><span>Simple booking.</span></h1><p>Browse available rooms, submit a booking request, and check your status anytime — even when the app is offline.</p><button className="btn btn-primary btn-lg" onClick={onCustomer}>Browse Rooms <i className="bi bi-arrow-right"/></button></div><div className="hero-card"><i className="bi bi-building-check"/></div></section>
   <section className="container py-5"><div className="row g-3">{[["56+","Rooms"],[data.rooms.reduce((a,r)=>a+r.capacity,0)-data.rooms.reduce((a,r)=>a+r.tenants.length,0),"Available Beds"],[data.rooms.filter(r=>r.tenants.length<r.capacity).length,"Rooms with Space"],["₱2,500","Starting Rent"]].map(x=><div className="col-6 col-lg-3" key={x[1]}><div className="stat-card"><small>{x[1]}</small><strong>{x[0]}</strong></div></div>)}</div></section></main>
 </div>
}

function AdminLogin({data,onLogin,onHome}){
 const [email,setEmail]=useState(data.settings.email),[pass,setPass]=useState("");
 return <div className="login-page"><div className="login-box shadow-sm"><Brand/><div className="text-center my-4"><h2>Admin Login</h2><p className="muted">Manage your boarding house</p></div>
 <label>Email<input className="form-control" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Password<input className="form-control" type="password" placeholder="Default: admin123" value={pass} onChange={e=>setPass(e.target.value)}/></label>
 <button className="btn btn-primary w-100 py-2 mt-2" onClick={()=>email===data.settings.email&&pass===data.settings.adminPassword?onLogin():alert("Incorrect email or password.")}>Log In</button>
 <button className="btn btn-link w-100 mt-2" onClick={onHome}>← Back to Home</button></div></div>
}

function Admin({data,update,dark,setDark,onLogout,onCustomer}){
 const [page,setPage]=useState("dashboard"),[modal,setModal]=useState(null);
 const occ=data.rooms.reduce((a,r)=>a+r.tenants.length,0), beds=data.rooms.reduce((a,r)=>a+r.capacity,0)-occ;
 const nav=[["dashboard","grid-1x2","Dashboard"],["rooms","door-open","Rooms"],["tenants","people","Boarders"],["bookings","envelope-paper","Bookings"],["payments","cash-stack","Payments"],["settings","gear","Settings"]];
 const title=nav.find(n=>n[0]===page)?.[2]||"Dashboard";
 const addRoom=()=>{setModal({type:"room",room:null})};
 return <div className="admin-layout"><aside className="sidebar"><Brand/><nav>{nav.map(n=><button key={n[0]} className={"nav-btn "+(page===n[0]?"active":"")} onClick={()=>setPage(n[0])}><i className={"bi bi-"+n[1]}/><span>{n[2]}</span>{n[0]==="bookings"&&data.bookings.filter(b=>b.status==="Pending").length>0?<b className="nav-badge">{data.bookings.filter(b=>b.status==="Pending").length}</b>:null}</button>)}</nav><div className="sidebar-bottom"><button className="btn btn-link text-white-50 p-0 mb-3" onClick={onCustomer}><i className="bi bi-box-arrow-up-right"/> View Customer Site</button><div className="admin-mini"><div className="avatar">A</div><div><b>{data.settings.admin}</b><small>Cabael Admin</small></div></div><button className="btn btn-dark w-100" onClick={onLogout}>↪ Logout</button></div></aside>
 <main className="main-content"><header className="topbar"><div><div className="mobile-brand"><Brand small/></div><h1>{title}</h1><p>Manage your boarding house easily.</p></div><div className="d-flex align-items-center gap-2"><span className="live-indicator"><i/> Live</span><span className="clock">{new Date().toLocaleString()}</span><button className="btn btn-light" onClick={()=>setDark(!dark)}><i className={"bi "+(dark?"bi-sun":"bi-moon")}/></button></div></header>
 {page==="dashboard"&&<Dashboard data={data} occ={occ} beds={beds} onAdd={addRoom} setPage={setPage}/>}
 {page==="rooms"&&<Rooms data={data} update={update} onAdd={addRoom} setModal={setModal}/>}
 {page==="tenants"&&<Tenants data={data} update={update}/>}
 {page==="bookings"&&<Bookings data={data} update={update}/>}
 {page==="payments"&&<Payments data={data} update={update}/>}
 {page==="settings"&&<Settings data={data} update={update}/>}
 </main>{modal&&<RoomModal data={data} update={update} modal={modal} close={()=>setModal(null)}/>}</div>
}

function Dashboard({data,occ,beds,onAdd,setPage}){
 const income=data.tenants.reduce((a,t)=>a+Number(t.rent||0),0);
 return <><section className="welcome"><div><span className="eyebrow">CABAEL BOARDING HOUSE</span><h2>Good day, Admin 👋</h2><p>Here is your boarding house overview.</p></div><button className="btn btn-primary" onClick={onAdd}>＋ Add Room</button></section>
 <div className="row g-3 mb-3">{[["Total Rooms",data.rooms.length,"bi-door-open"],["Occupied",occ,"bi-people"],["Available Beds",beds,"bi-grid"],["Monthly Expected",money(income),"bi-cash-stack"]].map((s,i)=><div className="col-6 col-xl-3" key={s[0]}><div className="stat-card admin-stat"><i className={"bi "+s[2]}/><div><small>{s[0]}</small><strong>{s[1]}</strong></div></div></div>)}</div>
 <div className="row g-3"><div className="col-lg-7"><div className="card-box"><div className="card-head"><h3>Room Overview</h3><button className="btn btn-link" onClick={()=>setPage("rooms")}>View all</button></div>{data.rooms.slice(0,8).map(r=><div className="mini-row" key={r.id}><span className="room-square">{r.number}</span><div className="flex-grow-1"><b>Room {r.number}</b><small>{r.gender} • {r.tenants.length}/{r.capacity} beds</small></div><span>{r.light?"💡 On":"💡 Off"}</span></div>)}</div></div>
 <div className="col-lg-5"><div className="card-box"><div className="card-head"><h3>Recent Booking Requests</h3><button className="btn btn-link" onClick={()=>setPage("bookings")}>View all</button></div>{data.bookings.slice(-6).reverse().map(b=>{const r=data.rooms.find(x=>x.id===b.roomId);return <div className="mini-row" key={b.id}><span className="avatar small">{b.name?.[0]||"?"}</span><div className="flex-grow-1"><b>{b.name}</b><small>Room {r?.number||"—"} • {refCode(b.id)}</small></div><Status status={b.status}/></div>})}</div></div></div></>
}

const Status=({status})=><span className={"badge-status "+status.toLowerCase()}>{status}</span>;

async function logRoomAction(action, room, rooms){
  try {
    await fetch("http://localhost:8080/api/rooms/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, room, rooms })
    });
  } catch (error) {
    console.warn("Room terminal logging unavailable. Start backend-api with npm run dev.");
  }
}

function Rooms({data,update,onAdd,setModal}){
 const [q,setQ]=useState(""),[gender,setGender]=useState("all"),[status,setStatus]=useState("all");
 const rs=data.rooms.filter(r=>r.number.includes(q)&&(gender==="all"||r.gender===gender)&&(status==="all"||(status==="Available"?r.tenants.length<r.capacity:r.tenants.length>=r.capacity)));
 return <><div className="section-tools"><div><h2>Rooms Management</h2><p>Manage 50+ rooms, capacity, rent and lights.</p></div><button className="btn btn-primary" onClick={onAdd}>＋ Add Room</button></div>
 <div className="filters row g-2"><div className="col-md-5"><input className="form-control" placeholder="Search room number..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="col-md-3"><select className="form-select" value={gender} onChange={e=>setGender(e.target.value)}><option value="all">All Types</option><option>Male</option><option>Female</option><option>Mixed</option></select></div><div className="col-md-3"><select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All Status</option><option value="Available">Available</option><option value="Full">Full</option></select></div></div>
 <div className="room-grid">{rs.map(r=><RoomCard key={r.id} r={r} rooms={data.rooms} update={update} setModal={setModal}/>)}</div></>
}

function RoomCard({r,rooms,update,setModal}){
 const full=r.tenants.length>=r.capacity,pct=Math.min(100,r.tenants.length/r.capacity*100);
 const toggleLight=()=>{
   const next={...r,light:!r.light};
   const nextRooms=rooms.map(x=>x.id===r.id?next:x);
   update(d=>{const target=d.rooms.find(x=>x.id===r.id);if(target)target.light=!r.light;return d});
   logRoomAction("LIGHT_UPDATED",next,nextRooms);
 };
 const deleteRoom=()=>{
   if(!confirm(`Delete Room ${r.number}?\n\nThis room will be removed from the Rooms list.`)) return;
   const remaining=rooms.filter(x=>x.id!==r.id);
   update(d=>{d.rooms=d.rooms.filter(x=>x.id!==r.id);return d});
   logRoomAction("DELETED",{...r,status:"Deleted"},remaining);
 };
 return <div className="room-card"><div className="room-top"><b>Room {r.number}</b><span className={"badge gender-"+r.gender.toLowerCase()}>{r.gender}</span></div><div className="room-info"><span>🛏️ {r.tenants.length}/{r.capacity} occupants</span><span>💰 {money(r.rent)} / person / month</span><span>{r.light?"💡 Lights: ON":"💡 Lights: OFF"}</span></div><div className="progress mb-3"><div className="progress-bar" style={{width:pct+"%"}}/></div><div className="d-flex justify-content-between mb-3"><b>{full?"Full":`${r.capacity-r.tenants.length} bed(s) available`}</b><span className={"badge-status "+(full?"full":"space")}>{full?"FULL":"AVAILABLE"}</span></div><div className="d-flex gap-1 flex-wrap"><button className="btn btn-sm btn-light" onClick={toggleLight}>💡 Light</button><button className="btn btn-sm btn-light" onClick={()=>setModal({type:"room",room:r})}>View/Edit</button><button className="btn btn-sm btn-outline-danger" onClick={deleteRoom}>Delete</button></div></div>
}

function dataForRoomLog(r){
 return { ...r, status:r.tenants.length>=r.capacity?"Full":"Available" };
}

function RoomModal({data,update,modal,close}){
 const existing=modal.room;
 const [number,setNumber]=useState(existing?.number||String(data.rooms.length+1).padStart(2,"0"));
 const [gender,setGender]=useState(existing?.gender||"Male"),[capacity,setCapacity]=useState(existing?.capacity||5),[rent,setRent]=useState(existing?.rent||2500),[light,setLight]=useState(existing?.light??true);
 const submit=()=>{
   if(!number.trim())return;
   let savedRoom=null;
   if(existing){
     savedRoom={...existing,number:number.trim(),gender,capacity:Number(capacity),rent:Number(rent),light};
   }else{
     savedRoom={id:uid(),number:number.trim(),gender,capacity:Number(capacity),rent:Number(rent),light,tenants:[]};
   }
   const nextRooms=existing
     ? data.rooms.map(x=>x.id===existing.id?savedRoom:x)
     : [...data.rooms,savedRoom];
   update(d=>{
     if(existing){
       const target=d.rooms.find(x=>x.id===existing.id);
       if(target) Object.assign(target,{number:number.trim(),gender,capacity:Number(capacity),rent:Number(rent),light});
     }else{
       d.rooms.push(savedRoom);
     }
     return d;
   });
   logRoomAction(existing?"UPDATED":"CREATED",dataForRoomLog(savedRoom),nextRooms);
   close();
 };
 return <div className="modal-backdrop-custom"><div className="modal-card"><button className="modal-close" onClick={close}>×</button><h3>{existing?"Edit":"Add"} Room</h3><label>Room Number<input className="form-control" value={number} onChange={e=>setNumber(e.target.value)}/></label><div className="row g-2"><div className="col-6"><label>Type<select className="form-select" value={gender} onChange={e=>setGender(e.target.value)}><option>Male</option><option>Female</option><option>Mixed</option></select></label></div><div className="col-6"><label>Capacity<input className="form-control" type="number" min="1" value={capacity} onChange={e=>setCapacity(e.target.value)}/></label></div></div><label>Rent / person / month<input className="form-control" type="number" value={rent} onChange={e=>setRent(e.target.value)}/></label><label className="form-check mt-2"><input className="form-check-input" type="checkbox" checked={light} onChange={e=>setLight(e.target.checked)}/> Lights currently ON</label><button className="btn btn-primary w-100 mt-3" onClick={submit}>Save Room</button></div></div>
}

function Tenants({data,update}){
 const [q,setQ]=useState("");
 const ts=data.tenants.filter(t=>(t.name+" "+t.contact).toLowerCase().includes(q.toLowerCase()));
 return <><div className="section-tools"><div><h2>Boarders</h2><p>Current occupants and their room assignments.</p></div><input className="form-control max-input" placeholder="Search boarder..." value={q} onChange={e=>setQ(e.target.value)}/></div>
 <div className="card-box table-responsive"><table className="table align-middle"><thead><tr><th>Name</th><th>Room</th><th>Contact</th><th>Rent</th><th>Move-in</th><th></th></tr></thead><tbody>{ts.map(t=>{const r=data.rooms.find(x=>x.id===t.roomId);return <tr key={t.id}><td><b>{t.name}</b><div className="muted small">{t.gender}</div></td><td>Room {r?.number}</td><td>{t.contact}</td><td>{money(t.rent)}</td><td>{t.moveIn||"—"}</td><td><button className="btn btn-sm btn-outline-danger" onClick={()=>{if(confirm("Remove this boarder?"))update(d=>{const r=d.rooms.find(x=>x.id===t.roomId);if(r)r.tenants=r.tenants.filter(x=>x.id!==t.id);d.tenants=d.tenants.filter(x=>x.id!==t.id);return d})}}>Remove</button></td></tr>})}</tbody></table>{!ts.length&&<p className="muted">No boarders yet.</p>}</div></>
}

function Bookings({data,update}){
 const act=(b,status)=>update(d=>{const booking=d.bookings.find(x=>x.id===b.id);if(!booking)return d;booking.status=status;if(status==="Approved"){const r=d.rooms.find(x=>x.id===b.roomId);if(r&&r.tenants.length<r.capacity&&!d.tenants.some(t=>t.bookingId===b.id)){const tenant={id:uid(),bookingId:b.id,roomId:b.roomId,name:b.name,gender:b.gender,contact:b.contact,rent:r.rent,moveIn:b.moveIn};r.tenants.push(tenant);d.tenants.push(tenant)}}return d});
 return <><div className="section-tools"><div><h2>Booking Requests</h2><p>Review customer requests and approve or reject them.</p></div></div><div className="booking-list">{data.bookings.slice().reverse().map(b=>{const r=data.rooms.find(x=>x.id===b.roomId);return <div className="card-box booking-card" key={b.id}><div><span className="eyebrow">{refCode(b.id)}</span><h4>{b.name}</h4><p className="muted mb-1">Room {r?.number} • {b.gender} • {b.contact}</p><p className="muted mb-1">Move-in: {b.moveIn||"Not specified"}</p>{b.notes&&<p className="small">Note: {b.notes}</p>}</div><div className="text-end"><Status status={b.status}/>{b.status==="Pending"&&<div className="mt-3 d-flex gap-2"><button className="btn btn-sm btn-success" disabled={!r||r.tenants.length>=r.capacity} onClick={()=>act(b,"Approved")}>Approve</button><button className="btn btn-sm btn-outline-danger" onClick={()=>act(b,"Rejected")}>Reject</button></div>}</div></div>})}</div>{!data.bookings.length&&<div className="card-box muted">No booking requests yet.</div>}</>
}

function Payments({data,update}){
 const [name,setName]=useState(""),[amount,setAmount]=useState("2500"),[room,setRoom]=useState(data.rooms[0]?.id||1);
 const add=()=>{if(!name||!amount)return;update(d=>{d.payments.push({id:uid(),name,roomId:Number(room),amount:Number(amount),date:new Date().toISOString().slice(0,10),status:"Paid"});return d});setName("")};
 return <><div className="section-tools"><div><h2>Payments</h2><p>Record and review rent payments.</p></div></div><div className="row g-3"><div className="col-lg-4"><div className="card-box"><h4>Record Payment</h4><label>Boarder Name<input className="form-control" value={name} onChange={e=>setName(e.target.value)}/></label><label>Room<select className="form-select" value={room} onChange={e=>setRoom(e.target.value)}>{data.rooms.map(r=><option key={r.id} value={r.id}>Room {r.number}</option>)}</select></label><label>Amount<input className="form-control" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="btn btn-primary w-100" onClick={add}>Save Payment</button></div></div><div className="col-lg-8"><div className="card-box table-responsive"><table className="table align-middle"><thead><tr><th>Boarder</th><th>Room</th><th>Amount</th><th>Date</th></tr></thead><tbody>{data.payments.slice().reverse().map(p=>{const r=data.rooms.find(x=>x.id===p.roomId);return <tr key={p.id}><td>{p.name}</td><td>{r?.number}</td><td>{money(p.amount)}</td><td>{p.date}</td></tr>})}</tbody></table></div></div></div></>
}

function Settings({data,update}){
 const [s,setS]=useState(data.settings);
 const save=()=>update(d=>{d.settings={...s};return d});
 return <><div className="section-tools"><div><h2>Settings</h2><p>Update boarding house and admin information.</p></div></div><div className="card-box settings-card"><div className="row g-3"><div className="col-md-6"><label>House Name<input className="form-control" value={s.house} onChange={e=>setS({...s,house:e.target.value})}/></label></div><div className="col-md-6"><label>Address<input className="form-control" value={s.address} onChange={e=>setS({...s,address:e.target.value})}/></label></div><div className="col-md-6"><label>Contact<input className="form-control" value={s.contact} onChange={e=>setS({...s,contact:e.target.value})}/></label></div><div className="col-md-6"><label>Admin Name<input className="form-control" value={s.admin} onChange={e=>setS({...s,admin:e.target.value})}/></label></div><div className="col-md-6"><label>Admin Email<input className="form-control" value={s.email} onChange={e=>setS({...s,email:e.target.value})}/></label></div><div className="col-md-6"><label>Admin Password<input className="form-control" type="password" value={s.adminPassword} onChange={e=>setS({...s,adminPassword:e.target.value})}/></label></div></div><button className="btn btn-primary mt-4" onClick={save}>Save Settings</button><button className="btn btn-outline-danger mt-4 ms-2" onClick={()=>{if(confirm("Reset all local data?")){localStorage.removeItem(KEY);location.reload()}}}>Reset Demo Data</button></div></>
}

function CustomerLogin({data,onLogin,onHome}){
 const [tab,setTab]=useState("login"),[email,setEmail]=useState(""),[pass,setPass]=useState(""),[name,setName]=useState(""),[confirm,setConfirm]=useState("");
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[showPass,setShowPass]=useState(false),[showConfirm,setShowConfirm]=useState(false);

 const finishLogin=async(user)=>{
   const role=await getUserRole(user);
   saveAuthSession(user,role);
   onLogin(role);
 };

 const login=async()=>{
   setError("");
   if(!email.trim() || !pass) return setError("Please enter your email and password.");
   setLoading(true);
   try{
     const result=await signInWithEmailAndPassword(auth,email.trim(),pass);
     await finishLogin(result.user);
   }catch(err){
     console.error("Login Error:",err);
     const code=err?.code||"";
     if(code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) setError("Incorrect email or password.");
     else if(code.includes("invalid-email")) setError("Please enter a valid email address.");
     else if(code.includes("operation-not-allowed")) setError("Email/Password Sign-In is not enabled in Firebase Authentication.");
     else if(code.includes("permission-denied")) setError("Firestore denied access. Check Firestore Rules for users/{UID}.");
     else setError("Login failed. Please check Firebase Authentication and Firestore.");
     await signOut(auth).catch(()=>{});
   }finally{setLoading(false)}
 };

 const register=async()=>{
   setError("");
   if(name.trim().length<2) return setError("Please enter your full name.");
   if(!email.trim()) return setError("Please enter your email address.");
   if(pass.length<6) return setError("Password must be at least 6 characters.");
   if(pass!==confirm) return setError("Passwords do not match.");
   setLoading(true);
   try{
     const result=await createUserWithEmailAndPassword(auth,email.trim(),pass);
     if(name.trim()) await updateProfile(result.user,{displayName:name.trim()});
     await setDoc(doc(db,"users",result.user.uid),{
       uid:result.user.uid,
       name:name.trim(),
       email:result.user.email||email.trim(),
       role:"user",
       provider:"password",
       createdAt:serverTimestamp(),
       updatedAt:serverTimestamp()
     },{merge:true});
     await finishLogin(result.user);
   }catch(err){
     console.error("Registration Error:",err);
     const code=err?.code||"";
     if(code.includes("email-already-in-use")) setError("This email is already registered. Please log in instead.");
     else if(code.includes("invalid-email")) setError("Please enter a valid email address.");
     else if(code.includes("operation-not-allowed")) setError("Email/Password Sign-In is not enabled in Firebase Authentication.");
     else if(code.includes("weak-password")) setError("Password is too weak. Use at least 6 characters.");
     else if(code.includes("permission-denied")) setError("Firestore denied creating your profile. Check Firestore Rules.");
     else setError("Registration failed. Check your Firebase settings.");
     await signOut(auth).catch(()=>{});
   }finally{setLoading(false)}
 };

 const googleLogin=async()=>{
   setError(""); setLoading(true);
   try{
     const result=await signInWithPopup(auth,googleProvider);
     await finishLogin(result.user);
   }catch(err){
     console.error("Google Sign-In Error:",err); const code=err?.code||"";
     if(code.includes("popup-closed-by-user")) setError("Google sign-in was cancelled.");
     else if(code.includes("unauthorized-domain")) setError("This website domain is not authorized in Firebase. Add localhost to Firebase Authentication → Settings → Authorized domains.");
     else if(code.includes("operation-not-allowed")) setError("Google Sign-In is not enabled in Firebase Authentication.");
     else if(code.includes("permission-denied")) setError("Google login worked, but Firestore denied access to users/{UID}. Check Firestore Rules.");
     else setError("Google Sign-In failed. Check Firebase Authentication and Firestore.");
     await signOut(auth).catch(()=>{});
   }finally{setLoading(false)}
 };
 return <div className="login-page modern-auth"><div className="auth-visual"><div className="auth-overlay"><Brand/><div className="auth-copy"><span className="eyebrow">WELCOME TO CABAEL</span><h1>Find a place that feels like home.</h1><p>Comfortable rooms, simple booking, and easy access to your boarding information.</p><div className="auth-features"><span><i className="bi bi-shield-check"/> Secure account</span><span><i className="bi bi-phone"/> Mobile friendly</span><span><i className="bi bi-house-heart"/> 56+ rooms</span></div></div></div></div>
 <div className="auth-panel"><div className="auth-panel-inner"><button className="auth-back" onClick={onHome}><i className="bi bi-arrow-left"/> Home</button><div className="auth-mobile-brand"><Brand/></div><div className="auth-heading"><span className="eyebrow">CABAEL BOARDING HOUSE</span><h2>{tab==="login"?"Welcome back":"Create your account"}</h2><p>{tab==="login"?"Sign in to book a room and check your booking status.":"Register as a boarder to start booking a room."}</p></div>
 <div className="auth-tabs"><button className={tab==="login"?"active":""} onClick={()=>{setTab("login");setError("")}}>Log In</button><button className={tab==="register"?"active":""} onClick={()=>{setTab("register");setError("")}}>Register</button></div>
 <button className="btn btn-outline-dark w-100 py-2 google-login" onClick={googleLogin} disabled={loading}><i className="bi bi-google me-2"/>{loading?"Connecting…":"Continue with Google"}</button><div className="login-divider"><span>or</span></div>
 {tab==="register"&&<label>Full Name<input className="form-control auth-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Juan Dela Cruz" autoComplete="name"/></label>}
 <label>Email<input className="form-control auth-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>
 <label>Password<div className="password-wrap"><input className="form-control auth-input" type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder={tab==="login"?"Enter your password":"At least 6 characters"} autoComplete={tab==="login"?"current-password":"new-password"}/><button type="button" onClick={()=>setShowPass(!showPass)}><i className={"bi "+(showPass?"bi-eye-slash":"bi-eye")}/></button></div></label>
 {tab==="register"&&<label>Confirm Password<div className="password-wrap"><input className="form-control auth-input" type={showConfirm?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat your password" autoComplete="new-password"/><button type="button" onClick={()=>setShowConfirm(!showConfirm)}><i className={"bi "+(showConfirm?"bi-eye-slash":"bi-eye")}/></button></div></label>}
 {error&&<div className="alert alert-danger py-2 mt-3 mb-0 small"><i className="bi bi-exclamation-circle me-1"/>{error}</div>}
 <button className="btn btn-primary w-100 py-2 mt-3 auth-submit" disabled={loading} onClick={tab==="login"?login:register}>{loading?(tab==="login"?"Signing in…":"Creating account…"):(tab==="login"?"Log In":"Create Account")}</button>
 <div className="auth-switch">{tab==="login"?<>Don't have an account? <button onClick={()=>{setTab("register");setError("")}}>Create one</button></>:<>Already have an account? <button onClick={()=>{setTab("login");setError("")}}>Log in</button></>}</div>
 </div></div></div>
}

function Customer({data,update,logged,setLogged,onHome,onAdmin,onLogout}){
 const [page,setPage]=useState("browse"),[q,setQ]=useState(""),[gender,setGender]=useState("all"),[status,setStatus]=useState("Available"),[modal,setModal]=useState(null);
 const [lookup,setLookup]=useState(""),[result,setResult]=useState(null);
 const rooms=data.rooms.filter(r=>r.number.includes(q)&&(gender==="all"||r.gender===gender)&&(status==="all"||(status==="Available"?r.tenants.length<r.capacity:r.tenants.length>=r.capacity)));
 const submit=(room,b)=>{update(d=>{d.bookings.push({...b,id:uid(),roomId:room.id,status:"Pending",createdAt:new Date().toISOString()});return d});setModal(null);alert("Booking request sent. Your reference code will be shown after submission.")};
 return <div className="customer-page"><header className="cust-topbar"><button className="cust-brand border-0 bg-transparent" onClick={onHome}><Brand/></button><nav><button className={"cust-nav "+(page==="browse"?"active":"")} onClick={()=>setPage("browse")}>Browse Rooms</button><button className={"cust-nav "+(page==="status"?"active":"")} onClick={()=>setPage("status")}>Check My Booking</button></nav><div className="ms-auto d-flex gap-2">{logged ? <button className="btn btn-outline-danger btn-sm" onClick={onLogout}>Logout</button> : <button className="btn btn-primary btn-sm" onClick={onHome}>Home</button>}</div></header>
 <main className="cust-main container">{page==="browse"?<><section className="welcome"><div><span className="eyebrow">FIND YOUR ROOM</span><h2>Choose a room that fits you</h2><p>Browse rooms and send a booking request to the admin.</p></div></section><div className="filters row g-2 mb-3"><div className="col-md-5"><input className="form-control" placeholder="Search room number..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="col-md-3"><select className="form-select" value={gender} onChange={e=>setGender(e.target.value)}><option value="all">All Types</option><option>Male</option><option>Female</option><option>Mixed</option></select></div><div className="col-md-3"><select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}><option value="Available">Has Space</option><option value="all">All Status</option><option value="Full">Full</option></select></div></div><div className="room-grid">{rooms.map(r=><CustomerRoom key={r.id} r={r} onBook={()=>setModal(r)}/>)}</div></>:<><section className="welcome"><div><span className="eyebrow">BOOKING STATUS</span><h2>Check your booking request</h2><p>Use your reference code or contact number.</p></div></section><div className="card-box lookup"><div className="input-group"><input className="form-control" placeholder="e.g. CB-482913 or 09171234567" value={lookup} onChange={e=>setLookup(e.target.value)}/><button className="btn btn-primary" onClick={()=>setResult(data.bookings.filter(b=>refCode(b.id).toLowerCase()===lookup.toLowerCase()||b.contact===lookup))}>Check Status</button></div>{result&&<div className="mt-4">{result.length?result.map(b=><div className="mini-row" key={b.id}><div><b>{b.name}</b><small>{refCode(b.id)} • Room {data.rooms.find(r=>r.id===b.roomId)?.number}</small></div><Status status={b.status}/></div>):<p className="muted">No booking found.</p>}</div>}</div></>}</main>{modal&&<BookingModal room={modal} close={()=>setModal(null)} submit={submit}/>}</div>
}

function CustomerRoom({r,onBook}){const full=r.tenants.length>=r.capacity,pct=Math.min(100,r.tenants.length/r.capacity*100);return <div className="room-card"><div className="room-top"><b>Room {r.number}</b><span className={"badge gender-"+r.gender.toLowerCase()}>{r.gender}</span></div><div className="room-info"><span>🛏️ {r.tenants.length}/{r.capacity} occupants</span><span>💰 {money(r.rent)} / person / month</span></div><div className="progress mb-3"><div className="progress-bar" style={{width:pct+"%"}}/></div><div className="d-flex justify-content-between"><b>{full?"Full":`${r.capacity-r.tenants.length} bed(s) available`}</b><span className={"badge-status "+(full?"full":"space")}>{full?"FULL":"AVAILABLE"}</span></div><button className="btn btn-primary w-100 mt-3" disabled={full} onClick={onBook}>{full?"Room Full":"Book This Room"}</button></div>}

function BookingModal({room,close,submit}){
 const [b,setB]=useState({name:"",gender:room.gender==="Mixed"?"Male":room.gender,contact:"",moveIn:"",notes:""});
 return <div className="modal-backdrop-custom"><div className="modal-card"><button className="modal-close" onClick={close}>×</button><h3>Book Room {room.number}</h3><p className="muted">{room.gender} room • {money(room.rent)} / person / month</p><label>Full Name<input className="form-control" value={b.name} onChange={e=>setB({...b,name:e.target.value})}/></label><label>Gender<select className="form-select" value={b.gender} onChange={e=>setB({...b,gender:e.target.value})}><option>Male</option><option>Female</option></select></label><label>Contact Number<input className="form-control" value={b.contact} onChange={e=>setB({...b,contact:e.target.value})}/></label><label>Preferred Move-in Date<input className="form-control" type="date" value={b.moveIn} onChange={e=>setB({...b,moveIn:e.target.value})}/></label><label>Notes<input className="form-control" value={b.notes} onChange={e=>setB({...b,notes:e.target.value})}/></label><button className="btn btn-primary w-100 mt-2" disabled={!b.name||!b.contact} onClick={()=>submit(room,b)}>Send Booking Request</button></div></div>
}

function AppRoot(){return <App/>}
createRoot(document.getElementById("root")).render(<AppRoot/>);
