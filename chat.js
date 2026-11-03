(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let activeId=null, channel=null;
 async function load(){
  const el=$("chatPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">চ্যাট লোড হচ্ছে…</p>';
  const {data,error}=await db.from("support_conversations").select("id,customer_name,customer_phone,subject,status,updated_at").order("updated_at",{ascending:false}).limit(100);
  if(error){el.innerHTML='<p class="error pad">চ্যাট ডেটাবেসে সংযোগ হয়নি: '+esc(error.message)+'<br>কাস্টমার চ্যাট চালু করতে স্টোরফ্রন্টের চ্যাট উইজেট সংযুক্ত করতে হবে।</p>';return;}
  const rows=data||[];
  el.innerHTML='<div class="chat-layout"><div class="chat-list"><h3>কথোপকথন ('+rows.length+')</h3>'+(rows.length?rows.map(x=>'<button type="button" class="chat-thread '+(x.id===activeId?'active':'')+'" data-id="'+x.id+'"><b>'+esc(x.customer_name)+'</b><small>'+esc(x.customer_phone||x.subject||"নতুন মেসেজ")+'</small><small>'+esc(x.status==="open"?"চলমান":"বন্ধ")+'</small></button>').join(""):'<p class="muted">এখনো কোনো কাস্টমার মেসেজ আসেনি।</p>')+'</div><div class="chat-main" id="chatThread"><p class="muted pad">বাম পাশ থেকে একটি কথোপকথন নির্বাচন করুন।</p></div></div>';
  el.querySelectorAll(".chat-thread").forEach(b=>b.onclick=()=>openThread(b.dataset.id));
 }
 async function openThread(id){
  activeId=id;
  const box=$("chatThread");if(!box)return;
  box.innerHTML='<p class="muted pad">মেসেজ লোড হচ্ছে…</p>';
  const [conv,msgs,user]=await Promise.all([
   db.from("support_conversations").select("id,customer_name,customer_phone,status").eq("id",id).single(),
   db.from("support_messages").select("id,sender_type,body,created_at").eq("conversation_id",id).order("created_at"),
   db.auth.getUser()
  ]);
  if(conv.error||msgs.error){box.innerHTML='<p class="error pad">'+esc((conv.error||msgs.error).message)+'</p>';return;}
  box.innerHTML='<div class="chat-head"><b>'+esc(conv.data.customer_name)+'</b><small>'+esc(conv.data.customer_phone||"ফোন নম্বর নেই")+'</small><button type="button" class="secondary" id="chatToggle">'+(conv.data.status==="open"?"চ্যাট বন্ধ করুন":"চ্যাট খুলুন")+'</button></div><div class="chat-messages" id="chatMessages">'+(msgs.data||[]).map(m=>'<div class="chat-bubble '+(m.sender_type==="admin"?"mine":"theirs")+'"><p>'+esc(m.body)+'</p><small>'+new Date(m.created_at).toLocaleString("bn-BD")+'</small></div>').join("")+'</div><form id="chatReply" class="chat-reply"><textarea name="body" required maxlength="5000" rows="2" placeholder="কাস্টমারকে উত্তর লিখুন…"></textarea><button class="primary" type="submit">উত্তর পাঠান</button></form>';
  $("chatToggle").onclick=async()=>{const next=conv.data.status==="open"?"closed":"open";const {error}=await db.from("support_conversations").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);if(error)alert(error.message);else load();};
  $("chatReply").onsubmit=async ev=>{ev.preventDefault();const btn=ev.currentTarget.querySelector("button"),body=String(new FormData(ev.currentTarget).get("body")||"").trim();if(!body)return;btn.disabled=true;
   const {error}=await db.from("support_messages").insert({conversation_id:id,sender_type:"admin",sender_user_id:user.data.user?.id||null,body});
   if(error)alert("উত্তর পাঠানো যায়নি: "+error.message);else{await db.from("support_conversations").update({updated_at:new Date().toISOString()}).eq("id",id);openThread(id);}
   btn.disabled=false;
  };
  if(channel)db.removeChannel(channel);
  channel=db.channel("support-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"support_messages",filter:"conversation_id=eq."+id},()=>openThread(id)).subscribe();
 }
 $("chatRefresh")?.addEventListener("click",load);
 document.getElementById("sideNav")?.addEventListener("click",ev=>{if(ev.target.closest('[data-page="chat"]'))setTimeout(()=>load(),350);});
 window.addEventListener("beforeunload",()=>{if(channel)db.removeChannel(channel);});
})();