/* I M SHOP Admin modules — consolidated version.
   Removed legacy/duplicate module handlers. The remaining v2 modules are the single
   active renderer for each page; core login, dashboard, products creation and orders
   remain in app.js. */

/* Category module v2: create, edit, activate/deactivate, and safe delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function renderCategories(){
  const el=$("categoriesPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">ক্যাটাগরি লোড হচ্ছে…</p>';
  const {data,error}=await db.from("categories").select("id,name,parent_id,is_active,sort_order").order("sort_order").order("name");
  if(error){el.innerHTML='<p class="error pad">ক্যাটাগরি লোড হয়নি: '+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<form id="catV2Form" class="module-form"><h3>নতুন ক্যাটাগরি / সাব-ক্যাটাগরি</h3><label>নাম<input name="name" maxlength="100" required placeholder="যেমন: পাঞ্জাবি"></label><label>মূল ক্যাটাগরি<select name="parent_id"><option value="">প্রধান ক্যাটাগরি</option>'+rows.filter(x=>!x.parent_id).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><button class="primary" type="submit">ক্যাটাগরি যোগ করুন</button><p id="catV2Msg" class="message" aria-live="polite"></p></form><h3>ক্যাটাগরি তালিকা</h3><div class="table-wrap"><table><thead><tr><th>নাম</th><th>ধরন</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+rows.map(x=>'<tr data-id="'+x.id+'"><td><input class="cat-v2-name" value="'+esc(x.name)+'" maxlength="100" aria-label="ক্যাটাগরির নাম"></td><td>'+(x.parent_id?'সাব-ক্যাটাগরি':'প্রধান ক্যাটাগরি')+'</td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'</td><td><button type="button" class="secondary cat-v2-save">নাম সংরক্ষণ</button> <button type="button" class="secondary cat-v2-toggle" data-active="'+x.is_active+'">'+(x.is_active?'বন্ধ':'চালু')+'</button> <button type="button" class="secondary cat-v2-delete">মুছুন</button></td></tr>').join("")+'</tbody></table></div>';
  $("catV2Form").onsubmit=async ev=>{
   ev.preventDefault();const f=new FormData(ev.currentTarget),name=String(f.get("name")||"").trim();
   if(!name)return;
   const {error}=await db.from("categories").insert({name,parent_id:f.get("parent_id")||null,is_active:true,sort_order:rows.length+1});
   const m=$("catV2Msg");m.textContent=error?"সংরক্ষণ হয়নি: "+error.message:"ক্যাটাগরি যোগ হয়েছে।";m.className="message "+(error?"error":"success");
   if(!error)renderCategories();
  };
  el.querySelectorAll(".cat-v2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),name=tr.querySelector(".cat-v2-name").value.trim();
   if(!name){alert("ক্যাটাগরির নাম লিখুন।");return;}
   b.disabled=true;const {error}=await db.from("categories").update({name}).eq("id",tr.dataset.id);
   if(error)alert("নাম পরিবর্তন হয়নি: "+error.message);else renderCategories();b.disabled=false;
  });
  el.querySelectorAll(".cat-v2-toggle").forEach(b=>b.onclick=async()=>{
   b.disabled=true;const {error}=await db.from("categories").update({is_active:b.dataset.active!=="true"}).eq("id",b.closest("tr").dataset.id);
   if(error)alert("অবস্থা বদল হয়নি: "+error.message);else renderCategories();b.disabled=false;
  });
  el.querySelectorAll(".cat-v2-delete").forEach(b=>b.onclick=async()=>{
   const id=b.closest("tr").dataset.id;
   const [p,ch]=await Promise.all([
    db.from("products").select("id",{count:"exact",head:true}).eq("category_id",id),
    db.from("categories").select("id",{count:"exact",head:true}).eq("parent_id",id)
   ]);
   if(p.error||ch.error){alert("মুছতে যাচাই করা যায়নি: "+(p.error||ch.error).message);return;}
   if((p.count||0)>0||(ch.count||0)>0){alert("এই ক্যাটাগরির অধীনে পণ্য বা সাব-ক্যাটাগরি আছে। আগে সেগুলো অন্য ক্যাটাগরিতে সরান।");return;}
   if(!confirm("এই ক্যাটাগরি স্থায়ীভাবে মুছবেন?"))return;
   b.disabled=true;const {error}=await db.from("categories").delete().eq("id",id);
   if(error)alert("মুছতে সমস্যা: "+error.message);else renderCategories();b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="categories"]'))setTimeout(()=>renderCategories().catch(e=>{const el=$("categoriesPanel");if(el)el.textContent=e.message;}),500);
 });
})();


/* Inventory module v2: stock adjustment, low-stock watch, and movement history. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function renderInventory(){
  const el=$("inventoryPanel");if(!el)return;
  el.innerHTML='<p class="muted pad">স্টক তথ্য লোড হচ্ছে…</p>';
  const [p,m]=await Promise.all([
   db.from("products").select("id,name,sku,stock_quantity,is_active").order("name").limit(500),
   db.from("admin_app_stock_movements").select("id,product_id,quantity_before,quantity_after,change_amount,reason,note,created_at").order("created_at",{ascending:false}).limit(100)
  ]);
  if(p.error){el.innerHTML='<p class="error pad">পণ্যের স্টক লোড হয়নি: '+esc(p.error.message)+'</p>';return;}
  const products=p.data||[], movements=m.error?[]:(m.data||[]), names=Object.fromEntries(products.map(x=>[x.id,x.name]));
  const low=products.filter(x=>Number(x.stock_quantity||0)<=5);
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+low.length+'</b><span>কম স্টক (৫ বা কম)</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)===0).length+'</b><span>স্টক শেষ</span></article></div><h3>স্টক আপডেট</h3><div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>SKU</th><th>বর্তমান স্টক</th><th>নতুন স্টক</th><th>কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+esc(x.name)+'</td><td>'+esc(x.sku||"—")+'</td><td>'+Number(x.stock_quantity||0)+'</td><td><input class="inv-v2-qty" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="নতুন স্টক"></td><td><button class="secondary inv-v2-save">স্টক সংরক্ষণ</button></td></tr>').join("")+'</tbody></table></div><h3>কম স্টকের পণ্য</h3>'+ (low.length?'<ul>'+low.map(x=>'<li>'+esc(x.name)+' — '+Number(x.stock_quantity||0)+' টি</li>').join("")+'</ul>':'<p class="muted">এখন কোনো পণ্যের স্টক কম নেই।')+'</p><h3>সর্বশেষ স্টক পরিবর্তনের ইতিহাস</h3>'+(m.error?'<p class="error">ইতিহাসের টেবিল পাওয়া যায়নি: '+esc(m.error.message)+'</p>':(movements.length?'<div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>আগের স্টক</th><th>পরের স্টক</th><th>পরিবর্তন</th><th>কারণ</th><th>সময়</th></tr></thead><tbody>'+movements.map(x=>'<tr><td>'+esc(names[x.product_id]||"পণ্য আর তালিকায় নেই")+'</td><td>'+x.quantity_before+'</td><td>'+x.quantity_after+'</td><td>'+(x.change_amount>0?"+":"")+x.change_amount+'</td><td>'+esc(x.reason||"manual_adjustment")+(x.note?" — "+esc(x.note):"")+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">এখনো স্টক পরিবর্তনের ইতিহাস নেই।</p>'));
  el.querySelectorAll(".inv-v2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),qty=Number(tr.querySelector(".inv-v2-qty").value);
   if(!Number.isInteger(qty)||qty<0){alert("স্টক শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।");return;}
   b.disabled=true;
   const {error}=await db.from("products").update({stock_quantity:qty}).eq("id",tr.dataset.id);
   if(error)alert("স্টক সংরক্ষণ হয়নি: "+error.message);else renderInventory();
   b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="inventory"]'))setTimeout(()=>renderInventory().catch(e=>{const el=$("inventoryPanel");if(el)el.textContent=e.message;}),500);
 });
})();


/* Product module v2: image replacement, featured flag, complete field edit, and safe archive/delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 async function renderProducts(){
  const el=$("productsList");if(!el)return;
  el.innerHTML='<p class="muted pad">পণ্য লোড হচ্ছে…</p>';
  const [p,c]=await Promise.all([
   db.from("products").select("id,name,description,sku,category_id,price,stock_quantity,is_active,is_featured,image_url,created_at").order("created_at",{ascending:false}).limit(300),
   db.from("categories").select("id,name").eq("is_active",true).order("sort_order")
  ]);
  if(p.error||c.error){el.innerHTML='<p class="error pad">'+esc((p.error||c.error).message)+'</p>';return;}
  const products=p.data||[],cats=c.data||[];
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+products.filter(x=>x.is_active).length+'</b><span>সক্রিয় পণ্য</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)<=5).length+'</b><span>কম স্টক</span></article></div><label>পণ্য খুঁজুন<input id="productV2Search" placeholder="নাম বা SKU লিখুন"></label><div class="table-wrap"><table><thead><tr><th>ছবি ও পণ্যের তথ্য</th><th>ক্যাটাগরি</th><th>দাম / স্টক</th><th>ফিচার</th><th>অবস্থা / কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px">':'')+'<input class="pv2-name" value="'+esc(x.name)+'" aria-label="পণ্যের নাম"><textarea class="pv2-desc" rows="2" aria-label="বিবরণ">'+esc(x.description||"")+'</textarea><input class="pv2-sku" value="'+esc(x.sku||"")+'" placeholder="SKU"></td><td><select class="pv2-cat"><option value="">ক্যাটাগরি নেই</option>'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.category_id?"selected":"")+'>'+esc(k.name)+'</option>').join("")+'</select></td><td><input class="pv2-price" type="number" min="0" step="0.01" value="'+Number(x.price||0)+'" aria-label="দাম"><input class="pv2-stock" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="স্টক"></td><td><label><input class="pv2-featured" type="checkbox" '+(x.is_featured?"checked":"")+'> ফিচার্ড</label><label class="pv2-image-label">নতুন ছবি<input class="pv2-image" type="file" accept="image/jpeg,image/png,image/webp"></label></td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'<br><button type="button" class="secondary pv2-save">সব সংরক্ষণ</button> <button type="button" class="secondary pv2-toggle" data-active="'+x.is_active+'">'+(x.is_active?'বন্ধ':'চালু')+'</button> <button type="button" class="secondary pv2-delete">মুছুন</button></td></tr>').join("")+'</tbody></table></div>';
  $("productV2Search").oninput=ev=>{const q=ev.target.value.toLowerCase();el.querySelectorAll("tbody tr").forEach(tr=>tr.hidden=!tr.innerText.toLowerCase().includes(q));};
  el.querySelectorAll(".pv2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),price=Number(tr.querySelector(".pv2-price").value),stock=Number(tr.querySelector(".pv2-stock").value),name=tr.querySelector(".pv2-name").value.trim(),file=tr.querySelector(".pv2-image").files[0];
   if(!name||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0){alert("নাম, দাম ও স্টক সঠিকভাবে দিন।");return;}
   b.disabled=true;let image_url;
   try{
    if(file){
     if(file.size>5*1024*1024)throw new Error("ছবির সাইজ ৫ MB-এর বেশি হতে পারবে না।");
     if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("শুধু JPG, PNG বা WebP ছবি দিন।");
     const ext=file.name.split(".").pop().toLowerCase(),path="products/"+crypto.randomUUID()+"."+ext;
     const {error:up}=await db.storage.from("products").upload(path,file,{contentType:file.type,upsert:false});if(up)throw up;
     image_url=db.storage.from("products").getPublicUrl(path).data.publicUrl;
    }
    const payload={name,description:tr.querySelector(".pv2-desc").value.trim(),sku:tr.querySelector(".pv2-sku").value.trim()||null,category_id:tr.querySelector(".pv2-cat").value||null,price,stock_quantity:stock,is_featured:tr.querySelector(".pv2-featured").checked};
    if(image_url)payload.image_url=image_url;
    const {error}=await db.from("products").update(payload).eq("id",tr.dataset.id);if(error)throw error;
    renderProducts();
   }catch(e){alert("পণ্য সংরক্ষণ হয়নি: "+e.message);b.disabled=false;}
  });
  el.querySelectorAll(".pv2-toggle").forEach(b=>b.onclick=async()=>{
   b.disabled=true;const {error}=await db.from("products").update({is_active:b.dataset.active!=="true"}).eq("id",b.closest("tr").dataset.id);
   if(error)alert(error.message);else renderProducts();b.disabled=false;
  });
  el.querySelectorAll(".pv2-delete").forEach(b=>b.onclick=async()=>{
   const id=b.closest("tr").dataset.id;
   const {count,error}=await db.from("order_items").select("id",{count:"exact",head:true}).eq("product_id",id);
   if(error){alert("অর্ডার-সংযোগ যাচাই করা যায়নি: "+error.message);return;}
   if((count||0)>0){
    if(!confirm("এই পণ্য পুরোনো অর্ডারে আছে। স্থায়ীভাবে মুছলে অর্ডারের তথ্য নষ্ট হতে পারে। পণ্যটি শুধু বন্ধ করবেন?"))return;
    const {error:e}=await db.from("products").update({is_active:false}).eq("id",id);if(e)alert(e.message);else renderProducts();return;
   }
   if(!confirm("এই পণ্য স্থায়ীভাবে মুছবেন?"))return;
   b.disabled=true;const {error:e}=await db.from("products").delete().eq("id",id);
   if(e)alert("পণ্য মুছতে সমস্যা: "+e.message);else renderProducts();b.disabled=false;
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  if(ev.target.closest('[data-page="products"]'))setTimeout(()=>renderProducts().catch(e=>{const el=$("productsList");if(el)el.textContent=e.message;}),550);
 });
})();


/* Customer and sales-report tools: search, date filters, and CSV exports. */
(() => {
 const C=window.IMSHOP_CONFIG||{};
 if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 function csv(name,rows){
  const body=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+body],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
 }
 async function customers(){
  const el=$("customersPanel");if(!el)return;
  el.innerHTML='<p class="muted">ক্রেতার তথ্য লোড হচ্ছে…</p>';
  const {data,error}=await db.from("customers").select("*").order("created_at",{ascending:false}).limit(1000);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  const rows=data||[];
  const norm=c=>({name:c.full_name||c.name||c.customer_name||"",phone:c.phone||c.mobile||c.phone_number||"",email:c.email||"",date:c.created_at||"",id:c.id||""});
  const normalized=rows.map(norm);
  el.innerHTML='<div class="module-kpis"><article><b>'+rows.length+'</b><span>সর্বশেষ ১০০০ ক্রেতা</span></article></div><div class="toolbar"><label>ক্রেতা খুঁজুন<input id="customerV2Search" placeholder="নাম, মোবাইল বা ইমেইল"></label><button id="customerV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div class="table-wrap"><table><thead><tr><th>নাম</th><th>ইমেইল</th><th>যোগদানের তারিখ</th></tr></thead><tbody>'+normalized.map(c=>'<tr><td>'+esc(c.name||"—")+'</td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td>'+esc(c.date?new Date(c.date).toLocaleDateString("bn-BD"):"—")+'</td></tr>').join("")+'</tbody></table></div>';
  $("customerV2Search").oninput=e=>{const q=e.target.value.toLowerCase();el.querySelectorAll("tbody tr").forEach(tr=>tr.hidden=!tr.innerText.toLowerCase().includes(q));};
  $("customerV2Export").onclick=()=>csv("im-shop-customers.csv",[["Name","Phone","Email","Created"],...normalized.map(c=>[c.name,c.phone,c.email,c.date])]);
 }
 async function reports(){
  const el=$("reportsPanel");if(!el)return;
  el.innerHTML='<p class="muted">বিক্রয় রিপোর্ট তৈরি হচ্ছে…</p>';
  const {data,error}=await db.from("orders").select("id,order_number,customer_name,total,status,created_at").order("created_at",{ascending:false}).limit(2000);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<div class="toolbar"><label>শুরুর তারিখ<input id="reportV2From" type="date"></label><label>শেষ তারিখ<input id="reportV2To" type="date"></label><button id="reportV2Apply" class="secondary" type="button">রিপোর্ট দেখুন</button><button id="reportV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="reportV2Summary"></div><div class="table-wrap" id="reportV2Table"></div>';
  function draw(){
   const from=$("reportV2From").value,to=$("reportV2To").value;
   const filtered=rows.filter(x=>(!from||String(x.created_at).slice(0,10)>=from)&&(!to||String(x.created_at).slice(0,10)<=to));
   const paid=filtered.filter(x=>!["cancelled","failed"].includes(String(x.status).toLowerCase()));
   const total=paid.reduce((s,x)=>s+Number(x.total||0),0);
   $("reportV2Summary").innerHTML='<div class="module-kpis"><article><b>'+filtered.length+'</b><span>মোট অর্ডার</span></article><article><b>'+paid.length+'</b><span>বাতিল/ব্যর্থ বাদে</span></article><article><b>'+money(total)+'</b><span>অর্ডার মূল্য (প্রাপ্ত অর্থ নয়)</span></article></div>';
   $("reportV2Table").innerHTML='<table><thead><tr><th>তারিখ</th><th>অর্ডার</th><th>ক্রেতা</th><th>মোট</th><th>স্ট্যাটাস</th></tr></thead><tbody>'+filtered.slice(0,500).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleDateString("bn-BD")+'</td><td>'+esc(x.order_number||x.id)+'</td><td>'+esc(x.customer_name||"—")+'</td><td>'+money(x.total)+'</td><td>'+esc(x.status)+'</td></tr>').join("")+'</tbody></table>';
   $("reportV2Export").onclick=()=>csv("im-shop-sales-report.csv",[["Date","Order","Customer","Total","Status"],...filtered.map(x=>[x.created_at,x.order_number||x.id,x.customer_name,x.total,x.status])]);
  }
  $("reportV2Apply").onclick=draw;draw();
 }
 document.getElementById("sideNav")?.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-page]");if(!b)return;
  if(b.dataset.page==="customers")setTimeout(()=>customers().catch(e=>{const el=$("customersPanel");if(el)el.textContent=e.message;}),650);
  if(b.dataset.page==="reports")setTimeout(()=>reports().catch(e=>{const el=$("reportsPanel");if(el)el.textContent=e.message;}),650);
 });
})();


/* Security workspace v2: assign a role to an existing active staff member and edit role permissions. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("securityPanel");if(!el)return;
  el.innerHTML='<p>নিরাপত্তা ও অনুমতি লোড হচ্ছে…</p>';
  const [s,r,p]=await Promise.all([
   db.from("staff_profiles").select("user_id,full_name,role,is_active").order("created_at",{ascending:false}),
   db.from("admin_app_staff_roles").select("*"),
   db.from("admin_app_permissions").select("*").order("role_key").order("module_key")
  ]);
  const err=s.error||r.error||p.error;
  if(err){el.innerHTML='<p class="error">ডেটা লোড হয়নি: '+esc(err.message)+'</p>';return;}
  const staff=(s.data||[]).filter(x=>x.is_active&&x.role!=="admin");
  el.innerHTML='<h3>স্টাফের ভূমিকা নির্ধারণ</h3><form id="secRoleForm" class="module-form"><label>সক্রিয় স্টাফ<select name="user_id" required><option value="">স্টাফ নির্বাচন করুন</option>'+staff.map(x=>'<option value="'+esc(x.user_id)+'">'+esc(x.full_name||x.user_id)+' · '+esc(x.user_id)+'</option>').join("")+'</select></label><label>কাজের ভূমিকা<select name="role_key"><option value="manager">ম্যানেজার</option><option value="product_manager">পণ্য ব্যবস্থাপক</option><option value="order_manager">অর্ডার ব্যবস্থাপক</option><option value="inventory_manager">ইনভেন্টরি ব্যবস্থাপক</option><option value="marketing_manager">মার্কেটিং ব্যবস্থাপক</option><option value="support">কাস্টমার সাপোর্ট</option></select></label><button class="primary">ভূমিকা সংরক্ষণ</button><p id="secRoleMsg" aria-live="polite"></p></form><h3>বর্তমান স্টাফ ভূমিকা</h3><div class="table-wrap"><table><thead><tr><th>স্টাফ</th><th>মূল ভূমিকা</th><th>বিশেষ ভূমিকা</th></tr></thead><tbody>'+staff.map(x=>{const z=(r.data||[]).find(y=>y.user_id===x.user_id);return '<tr><td>'+esc(x.full_name||x.user_id)+'</td><td>'+esc(x.role)+'</td><td>'+esc(z?.role_key||"নির্ধারিত নয়")+'</td></tr>';}).join("")+'</tbody></table></div><h3>রোলভিত্তিক অনুমতি</h3><p class="muted">প্রতিটি রোল ও মডিউলের দেখা, তৈরি, সম্পাদনা ও মুছার অনুমতি আলাদাভাবে সংরক্ষণ করুন।</p><div class="table-wrap"><table><thead><tr><th>রোল</th><th>মডিউল</th><th>দেখা</th><th>তৈরি</th><th>সম্পাদনা</th><th>মুছুন</th><th>সংরক্ষণ</th></tr></thead><tbody>'+ (p.data||[]).map((x,i)=>'<tr data-perm="'+i+'"><td>'+esc(x.role_key)+'</td><td>'+esc(x.module_key)+'</td>'+["can_view","can_create","can_edit","can_delete"].map(k=>'<td><input type="checkbox" data-field="'+k+'" '+(x[k]?'checked':'')+' aria-label="'+k+'"></td>').join("")+'<td><button class="secondary secPermSave" type="button">সংরক্ষণ</button></td></tr>').join("")+'</tbody></table></div><p id="secPermMsg" aria-live="polite"></p><h3>নিরাপত্তা অবস্থা</h3><p>অ্যাডমিন লগইন Supabase Auth দিয়ে যাচাই হয়। OTP/MFA সক্রিয় আছে—এমন দাবি করা হচ্ছে না; Supabase Auth-এ আলাদাভাবে যাচাই ও কনফিগার করতে হবে।';
  $("secRoleForm").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),uid=fd.get("user_id"),role=fd.get("role_key");if(!uid)return;const {error}=await db.from("admin_app_staff_roles").upsert({user_id:uid,role_key:role,updated_at:new Date().toISOString()},{onConflict:"user_id"});$("secRoleMsg").textContent=error?"সংরক্ষণ হয়নি: "+error.message:"স্টাফের ভূমিকা সংরক্ষিত হয়েছে।";if(!error)setTimeout(render,500);};
  el.querySelectorAll(".secPermSave").forEach(btn=>btn.onclick=async()=>{const tr=btn.closest("tr"),idx=Number(tr.dataset.perm),row=p.data[idx],patch={};tr.querySelectorAll("[data-field]").forEach(ch=>patch[ch.dataset.field]=ch.checked);btn.disabled=true;const {error}=await db.from("admin_app_permissions").update(patch).eq("role_key",row.role_key).eq("module_key",row.module_key);btn.disabled=false;$("secPermMsg").textContent=error?"অনুমতি সংরক্ষণ হয়নি: "+error.message:"অনুমতি আপডেট হয়েছে।";});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{const b=e.target.closest('[data-page="security"]');if(b)setTimeout(()=>render().catch(err=>{const el=$("securityPanel");if(el)el.textContent=err.message;}),1100);});
})();


/* Delivery-zone editor v2: edit charge, activate/deactivate, and safely remove zones. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 async function render(){
  const el=$("deliveryPanel");if(!el)return;
  const {data,error}=await db.from("admin_app_delivery_zones").select("*").order("zone_name");
  if(error){el.innerHTML='<p class="error">ডেলিভারি এলাকা লোড হয়নি: '+esc(error.message)+'</p>';return;}
  el.innerHTML='<form id="zoneV2Form" class="module-form"><h3>নতুন ডেলিভারি এলাকা</h3><label>এলাকার নাম<input name="zone_name" required maxlength="100"></label><label>ডেলিভারি চার্জ (৳)<input name="charge" type="number" min="0" step="1" required></label><button class="primary">এলাকা সংরক্ষণ</button><p id="zoneV2Msg" aria-live="polite"></p></form><h3>ডেলিভারি চার্জ তালিকা</h3><div class="table-wrap"><table><thead><tr><th>এলাকা</th><th>চার্জ</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (data||[]).map(x=>'<tr data-zone="'+esc(x.id)+'"><td><input class="zoneName" value="'+esc(x.zone_name)+'" aria-label="এলাকার নাম"></td><td><input class="zoneCharge" type="number" min="0" step="1" value="'+Number(x.charge||0)+'" aria-label="চার্জ"></td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary zoneSave" type="button">আপডেট</button> <button class="secondary zoneToggle" type="button" data-active="'+!!x.is_active+'">'+(x.is_active?"বন্ধ করুন":"চালু করুন")+'</button> <button class="secondary zoneDelete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table></div><p class="muted">এখানে চার্জ সংরক্ষণ হয়। গ্রাহকের অর্ডারে স্বয়ংক্রিয়ভাবে চার্জ বসানো এবং Steadfast/Pathao API সংযোগ এখনো আলাদা কাজ; API credentials ছাড়া কুরিয়ার বুকিং হবে না।</p>';
  $("zoneV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_delivery_zones").insert({zone_name:String(fd.get("zone_name")).trim(),charge:Number(fd.get("charge")),is_active:true});$("zoneV2Msg").textContent=error?"সংরক্ষণ হয়নি: "+error.message:"এলাকা সংরক্ষিত হয়েছে।";if(!error)render();};
  el.querySelectorAll("tr[data-zone]").forEach(tr=>{
   const id=tr.dataset.zone;
   tr.querySelector(".zoneSave").onclick=async()=>{const charge=Number(tr.querySelector(".zoneCharge").value),name=tr.querySelector(".zoneName").value.trim();if(!name||!Number.isFinite(charge)||charge<0){alert("সঠিক নাম ও চার্জ দিন।");return;}const {error}=await db.from("admin_app_delivery_zones").update({zone_name:name,charge}).eq("id",id);if(error)alert("আপডেট হয়নি: "+error.message);else render();};
   tr.querySelector(".zoneToggle").onclick=async()=>{const active=tr.querySelector(".zoneToggle").dataset.active==="true";const {error}=await db.from("admin_app_delivery_zones").update({is_active:!active}).eq("id",id);if(error)alert("অবস্থা বদলায়নি: "+error.message);else render();};
   tr.querySelector(".zoneDelete").onclick=async()=>{if(!confirm("এই ডেলিভারি এলাকা মুছবেন?"))return;const {error}=await db.from("admin_app_delivery_zones").delete().eq("id",id);if(error)alert("মুছা যায়নি: "+error.message);else render();};
  });
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="delivery"]'))setTimeout(()=>render().catch(err=>{const el=$("deliveryPanel");if(el)el.textContent=err.message;}),1200);});
})();


/* Payment settings v2: explicit gateway readiness and safe enable/disable controls. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("paymentsPanel");if(!el)return;
  const {data,error}=await db.from("admin_app_payment_methods").select("*").order("display_name");
  if(error){el.innerHTML='<p class="error">পেমেন্ট সেটিংস লোড হয়নি: '+esc(error.message)+'</p>';return;}
  const methods=data||[];
  el.innerHTML='<div class="module-kpis"><article><b>'+methods.length+'</b><span>কনফিগার করা পেমেন্ট পদ্ধতি</span></article><article><b>'+methods.filter(x=>x.is_enabled).length+'</b><span>অ্যাডমিন প্যানেলে চালু</span></article></div><h3>পেমেন্ট পদ্ধতি</h3><div class="table-wrap"><table><thead><tr><th>পদ্ধতি</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+methods.map(x=>'<tr><td>'+esc(x.display_name||"নাম দেওয়া হয়নি")+'</td><td>'+(x.is_enabled?"চালু":"বন্ধ")+'</td><td><button class="secondary payV2Toggle" type="button" data-id="'+esc(x.id)+'" data-enabled="'+!!x.is_enabled+'">'+(x.is_enabled?"বন্ধ করুন":"চালু করুন")+'</button></td></tr>').join("")+'</tbody></table></div><h3>গেটওয়ে প্রস্তুতি</h3><ul><li>Cash on Delivery (COD): পদ্ধতির রেকর্ড থাকলে চালু/বন্ধ করা যাবে।</li><li>bKash / Nagad: মার্চেন্ট অ্যাকাউন্ট, API key/secret ও সার্ভার-সাইড callback যাচাই ছাড়া অনলাইন পেমেন্ট গ্রহণ করা যাবে না।</li><li>এখানে চালু দেখানো মানে শুধু অ্যাডমিন সেটিংস চালু; গ্রাহকের checkout বা বাস্তব লেনদেন সংযুক্ত হয়েছে—এমন নয়।</li></ul>';
  el.querySelectorAll(".payV2Toggle").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;const enabled=btn.dataset.enabled==="true";const {error}=await db.from("admin_app_payment_methods").update({is_enabled:!enabled}).eq("id",btn.dataset.id);if(error){alert("পেমেন্ট সেটিংস বদলায়নি: "+error.message);btn.disabled=false;}else render();});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="payments"]'))setTimeout(()=>render().catch(err=>{const el=$("paymentsPanel");if(el)el.textContent=err.message;}),1200);});
})();


/* Marketing workspace v2: manage coupons and banners with safe validation, toggle and delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 async function render(){
  const el=$("marketingPanel");if(!el)return;
  const [c,b]=await Promise.all([db.from("admin_app_coupons").select("*").order("created_at",{ascending:false}),db.from("admin_app_banners").select("*").order("sort_order")]);
  if(c.error||b.error){el.innerHTML='<p class="error">মার্কেটিং ডেটা লোড হয়নি: '+esc((c.error||b.error).message)+'</p>';return;}
  el.innerHTML='<h3>ডিসকাউন্ট কুপন</h3><form id="couponV2Form" class="module-form"><label>কুপন কোড<input name="code" maxlength="40" required></label><label>ছাড়ের ধরন<select name="discount_type"><option value="fixed">নির্দিষ্ট টাকা</option><option value="percent">শতকরা</option></select></label><label>ছাড়ের পরিমাণ<input name="discount_value" type="number" min="0.01" step="0.01" required></label><label>ন্যূনতম অর্ডার<input name="min_order" type="number" min="0" value="0"></label><label>সর্বোচ্চ ব্যবহার<input name="max_uses" type="number" min="1" placeholder="ঐচ্ছিক"></label><label>মেয়াদ শেষ<input name="expires_at" type="datetime-local"></label><button class="primary">কুপন তৈরি</button><p id="couponV2Msg" aria-live="polite"></p></form><div class="table-wrap"><table><thead><tr><th>কোড</th><th>ছাড়</th><th>ব্যবহার</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (c.data||[]).map(x=>'<tr data-coupon="'+esc(x.id)+'"><td>'+esc(x.code)+'</td><td>'+esc(x.discount_type==="percent"?x.discount_value+"%":money(x.discount_value))+'</td><td>'+Number(x.used_count||0)+'/'+(x.max_uses??"∞")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary couponV2Toggle" type="button" data-on="'+!!x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button> <button class="secondary couponV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table></div><divider/><h3>স্টোর ব্যানার / স্লাইডার</h3><form id="bannerV2Form" class="module-form"><label>শিরোনাম<input name="title" required></label><label>ছবির URL<input name="image_url" type="url" required placeholder="https://..."></label><label>ক্লিক করলে যে লিংকে যাবে<input name="target_url" type="url" placeholder="ঐচ্ছিক"></label><label>প্রদর্শনের ক্রম<input name="sort_order" type="number" value="0"></label><button class="primary">ব্যানার যোগ করুন</button><p id="bannerV2Msg" aria-live="polite"></p></form><div class="table-wrap"><table><thead><tr><th>ব্যানার</th><th>ছবি</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (b.data||[]).map(x=>'<tr data-banner="'+esc(x.id)+'"><td>'+esc(x.title)+'</td><td>'+(x.image_url?'<a href="'+esc(x.image_url)+'" target="_blank" rel="noopener">ছবি দেখুন</a>':"—")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary bannerV2Toggle" type="button" data-on="'+!!x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button> <button class="secondary bannerV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table></div><p class="muted">কুপন ও ব্যানার এখানে ডেটাবেসে সংরক্ষণ হয়। গ্রাহকের checkout-এ কুপন যাচাই/ছাড় প্রয়োগ এবং storefront-এ ব্যানার দেখানোর সংযোগ আলাদা ধাপে পরীক্ষা করতে হবে।</p>';
  $("couponV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),value=Number(fd.get("discount_value")),type=fd.get("discount_type");if(!Number.isFinite(value)||value<=0||(type==="percent"&&value>100)){ $("couponV2Msg").textContent="ছাড়ের পরিমাণ সঠিক নয়। শতকরা ছাড় ১০০-এর বেশি হতে পারবে না।";return;}const payload={code:String(fd.get("code")).trim().toUpperCase(),discount_type:type,discount_value:value,min_order:Math.max(0,Number(fd.get("min_order")||0)),max_uses:fd.get("max_uses")?Number(fd.get("max_uses")):null,expires_at:fd.get("expires_at")?new Date(fd.get("expires_at")).toISOString():null};const {error}=await db.from("admin_app_coupons").insert(payload);$("couponV2Msg").textContent=error?"কুপন তৈরি হয়নি: "+error.message:"কুপন তৈরি হয়েছে।";if(!error)render();};
  $("bannerV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_banners").insert({title:String(fd.get("title")).trim(),image_url:fd.get("image_url"),target_url:fd.get("target_url")||null,sort_order:Number(fd.get("sort_order")||0),is_active:true});$("bannerV2Msg").textContent=error?"ব্যানার যোগ হয়নি: "+error.message:"ব্যানার যোগ হয়েছে।";if(!error)render();};
  el.querySelectorAll("tr[data-coupon]").forEach(tr=>{const id=tr.dataset.coupon;tr.querySelector(".couponV2Toggle").onclick=async ev=>{const btn=ev.currentTarget;const {error}=await db.from("admin_app_coupons").update({is_active:btn.dataset.on!=="true"}).eq("id",id);if(error)alert("কুপন আপডেট হয়নি: "+error.message);else render();};tr.querySelector(".couponV2Delete").onclick=async()=>{if(!confirm("কুপনটি মুছবেন?"))return;const {error}=await db.from("admin_app_coupons").delete().eq("id",id);if(error)alert("কুপন মুছা যায়নি: "+error.message);else render();};});
  el.querySelectorAll("tr[data-banner]").forEach(tr=>{const id=tr.dataset.banner;tr.querySelector(".bannerV2Toggle").onclick=async ev=>{const btn=ev.currentTarget;const {error}=await db.from("admin_app_banners").update({is_active:btn.dataset.on!=="true"}).eq("id",id);if(error)alert("ব্যানার আপডেট হয়নি: "+error.message);else render();};tr.querySelector(".bannerV2Delete").onclick=async()=>{if(!confirm("ব্যানারটি মুছবেন?"))return;const {error}=await db.from("admin_app_banners").delete().eq("id",id);if(error)alert("ব্যানার মুছা যায়নি: "+error.message);else render();};});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="marketing"]'))setTimeout(()=>render().catch(err=>{const el=$("marketingPanel");if(el)el.textContent=err.message;}),1500);});
})();


/* Notification center v2: create, search, export and delete admin notices. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("notificationsPanel");if(!el)return;
  const {data,error}=await db.from("admin_app_notifications").select("id,title,message,created_at").order("created_at",{ascending:false}).limit(500);
  if(error){el.innerHTML='<p class="error">নোটিফিকেশন লোড হয়নি: '+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<form id="noticeV2Form" class="module-form"><h3>নতুন অ্যাডমিন নোটিফিকেশন</h3><label>শিরোনাম<input name="title" required maxlength="150"></label><label>বিস্তারিত বার্তা<textarea name="message" rows="3" required maxlength="3000"></textarea></label><button class="primary">নোটিফিকেশন তৈরি</button><p id="noticeV2Msg" aria-live="polite"></p></form><div class="toolbar"><label>নোটিফিকেশন খুঁজুন<input id="noticeV2Search" placeholder="শিরোনাম বা বার্তা"></label><button id="noticeV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="noticeV2List" class="table-wrap"></div><p class="muted">এগুলো অ্যাডমিন প্যানেলের নোটিশ। গ্রাহকের ফোনে push notification বা SMS পাঠাতে আলাদা provider ও অনুমতি কনফিগার করতে হবে।</p>';
  function draw(){const q=$("noticeV2Search").value.toLowerCase(),filtered=rows.filter(x=>(x.title||"").toLowerCase().includes(q)||(x.message||"").toLowerCase().includes(q));$("noticeV2List").innerHTML='<table><thead><tr><th>শিরোনাম</th><th>বার্তা</th><th>তারিখ</th><th>কাজ</th></tr></thead><tbody>'+filtered.map(x=>'<tr data-notice="'+esc(x.id)+'"><td>'+esc(x.title)+'</td><td>'+esc(x.message)+'</td><td>'+esc(x.created_at?new Date(x.created_at).toLocaleString("bn-BD"):"—")+'</td><td><button class="secondary noticeV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table>';el.querySelectorAll(".noticeV2Delete").forEach(btn=>btn.onclick=async()=>{const id=btn.closest("tr").dataset.notice;if(!confirm("এই নোটিফিকেশনটি মুছবেন?"))return;const {error}=await db.from("admin_app_notifications").delete().eq("id",id);if(error)alert("মুছা যায়নি: "+error.message);else{const at=rows.findIndex(x=>x.id===id);if(at>=0)rows.splice(at,1);draw();}});}
  $("noticeV2Search").oninput=draw;
  $("noticeV2Export").onclick=()=>{const lines=[["Title","Message","Created"],...rows.map(x=>[x.title,x.message,x.created_at])],csv=lines.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="im-shop-notifications.csv";a.click();URL.revokeObjectURL(url);};
  $("noticeV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const {error}=await db.from("admin_app_notifications").insert({title:String(fd.get("title")).trim(),message:String(fd.get("message")).trim()});$("noticeV2Msg").textContent=error?"নোটিফিকেশন তৈরি হয়নি: "+error.message:"নোটিফিকেশন তৈরি হয়েছে।";if(!error){const {data}=await db.from("admin_app_notifications").select("id,title,message,created_at").order("created_at",{ascending:false}).limit(500);if(data){rows.splice(0,rows.length,...data);draw();ev.currentTarget.reset();}}};
  draw();
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="notifications"]'))setTimeout(()=>render().catch(err=>{const el=$("notificationsPanel");if(el)el.textContent=err.message;}),1500);});
})();


/* Store settings workspace: server-backed key/value settings and delivery defaults. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("settingsPanel");if(!el)return;
  el.innerHTML='<p>দোকানের সেটিংস লোড হচ্ছে…</p>';
  const {data,error}=await db.from("admin_app_settings").select("key,value");
  if(error){el.innerHTML='<p class="error">সেটিংস লোড হয়নি: '+esc(error.message)+'। ডেটাবেসে admin_app_settings টেবিল ও Admin write policy নিশ্চিত করতে হবে।</p>';return;}
  const v=Object.fromEntries((data||[]).map(x=>[x.key,x.value?.value??x.value??""]));
  const fields=[["store_name","দোকানের নাম","I M SHOP"],["phone","যোগাযোগের মোবাইল",""],["support_email","সাপোর্ট ইমেইল",""],["address","দোকানের ঠিকানা",""],["dhaka_delivery_charge","ঢাকার ডেলিভারি চার্জ (৳)","70"],["outside_dhaka_delivery_charge","ঢাকার বাইরের ডেলিভারি চার্জ (৳)","120"],["currency","মুদ্রা","BDT"],["order_prefix","অর্ডার নম্বরের প্রিফিক্স","IM"]];
  el.innerHTML='<form id="storeSettingsV2" class="module-form"><h3>দোকানের পরিচিতি</h3>'+fields.map(([k,label,def])=>'<label>'+label+'<input name="'+k+'" '+(["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(k)?'type="number" min="0" step="1"':'')+' value="'+esc(v[k]??def)+'" '+(k==="store_name"?"required":"")+'></label>').join("")+'<button class="primary" type="submit">সব সেটিংস সংরক্ষণ</button><p id="storeSettingsV2Msg" aria-live="polite"></p></form><p class="muted">এই মানগুলো অ্যাডমিন সেটিংসে সংরক্ষিত হবে। ডেলিভারি চার্জ Checkout-এ স্বয়ংক্রিয়ভাবে প্রয়োগ হচ্ছে—এমন নয়; সেটি অর্ডার তৈরির backend-এ আলাদাভাবে যুক্ত ও পরীক্ষা করতে হবে।';
  $("storeSettingsV2").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const payload=fields.map(([key])=>({key,value:{value:["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(key)?Number(fd.get(key)):String(fd.get(key)||"").trim()},updated_at:new Date().toISOString()}));for(const row of payload){if(["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(row.key)&&(!Number.isFinite(row.value.value)||row.value.value<0)){$("storeSettingsV2Msg").textContent="ডেলিভারি চার্জ শূন্য বা তার বেশি সংখ্যা হতে হবে।";return;}}const {error}=await db.from("admin_app_settings").upsert(payload,{onConflict:"key"});$("storeSettingsV2Msg").textContent=error?"সংরক্ষণ হয়নি: "+error.message:"দোকানের সেটিংস সার্ভারে সংরক্ষিত হয়েছে।";};
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="settings"]'))setTimeout(()=>render().catch(err=>{const el=$("settingsPanel");if(el)el.textContent=err.message;}),1600);});
})();
