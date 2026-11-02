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
   db.from("inventory_movements").select("id,product_id,quantity_change,reason,reference,created_at").order("created_at",{ascending:false}).limit(100)
  ]);
  if(p.error){el.innerHTML='<p class="error pad">পণ্যের স্টক লোড হয়নি: '+esc(p.error.message)+'</p>';return;}
  const products=p.data||[], movements=m.error?[]:(m.data||[]), names=Object.fromEntries(products.map(x=>[x.id,x.name]));
  const low=products.filter(x=>Number(x.stock_quantity||0)<=5);
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+low.length+'</b><span>কম স্টক (৫ বা কম)</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)===0).length+'</b><span>স্টক শেষ</span></article></div><h3>স্টক আপডেট</h3><div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>SKU</th><th>বর্তমান স্টক</th><th>নতুন স্টক</th><th>কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+esc(x.name)+'</td><td>'+esc(x.sku||"—")+'</td><td>'+Number(x.stock_quantity||0)+'</td><td><input class="inv-v2-qty" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="নতুন স্টক"></td><td><button class="secondary inv-v2-save">স্টক সংরক্ষণ</button></td></tr>').join("")+'</tbody></table></div><h3>কম স্টকের পণ্য</h3>'+ (low.length?'<ul>'+low.map(x=>'<li>'+esc(x.name)+' — '+Number(x.stock_quantity||0)+' টি</li>').join("")+'</ul>':'<p class="muted">এখন কোনো পণ্যের স্টক কম নেই।')+'</p><h3>সর্বশেষ স্টক পরিবর্তনের ইতিহাস</h3>'+(m.error?'<p class="error">ইতিহাসের টেবিল পাওয়া যায়নি: '+esc(m.error.message)+'</p>':(movements.length?'<div class="table-wrap"><table><thead><tr><th>পণ্য</th><th>আগের স্টক</th><th>পরের স্টক</th><th>পরিবর্তন</th><th>কারণ</th><th>সময়</th></tr></thead><tbody>'+movements.map(x=>'<tr><td>'+esc(names[x.product_id]||"পণ্য আর তালিকায় নেই")+'</td><td>'+''+'</td><td>'+''+'</td><td>'+(x.quantity_change>0?"+":"")+x.quantity_change+'</td><td>'+esc(x.reason||"manual_adjustment")+(x.reference?" — "+esc(x.reference):"")+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">এখনো স্টক পরিবর্তনের ইতিহাস নেই।</p>'));
  el.querySelectorAll(".inv-v2-save").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),qty=Number(tr.querySelector(".inv-v2-qty").value);
   if(!Number.isInteger(qty)||qty<0){alert("স্টক শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।");return;}
   b.disabled=true;
   const {error}=await db.rpc("admin_adjust_stock",{p_product_id:tr.dataset.id,p_new_quantity:qty,p_reason:"manual_adjustment"});
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
  el.innerHTML='<div class="module-kpis"><article><b>'+products.length+'</b><span>মোট পণ্য</span></article><article><b>'+products.filter(x=>x.is_active).length+'</b><span>সক্রিয় পণ্য</span></article><article><b>'+products.filter(x=>Number(x.stock_quantity||0)<=5).length+'</b><span>কম স্টক</span></article></div><label>পণ্য খুঁজুন<input id="productV2Search" placeholder="নাম বা SKU লিখুন"></label><div class="table-wrap"><table><thead><tr><th>ছবি ও পণ্যের তথ্য</th><th>ক্যাটাগরি</th><th>দাম / স্টক</th><th>ফিচার</th><th>অবস্থা / কাজ</th></tr></thead><tbody>'+products.map(x=>'<tr data-id="'+x.id+'"><td>'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px">':'')+'<input class="pv2-name" value="'+esc(x.name)+'" aria-label="পণ্যের নাম"><textarea class="pv2-desc" rows="2" aria-label="বিবরণ">'+esc(x.description||"")+'</textarea><input class="pv2-sku" value="'+esc(x.sku||"")+'" placeholder="SKU"></td><td><select class="pv2-cat"><option value="">ক্যাটাগরি নেই</option>'+cats.map(k=>'<option value="'+k.id+'" '+(k.id===x.category_id?"selected":"")+'>'+esc(k.name)+'</option>').join("")+'</select></td><td><input class="pv2-price" type="number" min="0" step="0.01" value="'+Number(x.price||0)+'" aria-label="দাম"><input class="pv2-stock" type="number" min="0" step="1" value="'+Number(x.stock_quantity||0)+'" aria-label="স্টক"></td><td><label><input class="pv2-featured" type="checkbox" '+(x.is_featured?"checked":"")+'> ফিচার্ড</label><label class="pv2-image-label">নতুন ছবি<input class="pv2-image" type="file" accept="image/jpeg,image/png,image/webp"></label></td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'<br><button type="button" class="secondary pv2-save">সব সংরক্ষণ</button> <button type="button" class="secondary pv2-toggle" data-active="'+x.is_active+'">'+(x.is_active?'বন্ধ':'চালু')+'</button> <button type="button" class="secondary pv2-variants">সাইজ/রং</button> <button type="button" class="secondary pv2-delete">মুছুন</button><div class="pv2-variant-box" hidden></div></td></tr>').join("")+'</tbody></table></div>';
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
  el.querySelectorAll(".pv2-variants").forEach(b=>b.onclick=async()=>{
   const tr=b.closest("tr"),box=tr.querySelector(".pv2-variant-box");
   if(!box.hidden){box.hidden=true;return;}
   box.hidden=false;box.innerHTML='<p class="muted">ভ্যারিয়েন্ট লোড হচ্ছে…</p>';
   const load=async()=>{
    const {data,error}=await db.from("product_variants").select("id,size,color,sku,price,stock_quantity,is_active").eq("product_id",tr.dataset.id).order("created_at");
    if(error){box.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
    box.innerHTML='<h4>সাইজ ও রংয়ের ভ্যারিয়েন্ট</h4><form class="pv2-variant-form module-form"><label>সাইজ<input name="size" maxlength="40" placeholder="S / M / L / XL"></label><label>রং<input name="color" maxlength="50" placeholder="কালো"></label><label>SKU<input name="sku" maxlength="80"></label><label>দাম (খালি রাখলে মূল পণ্যের দাম)<input name="price" type="number" min="0" step="0.01"></label><label>স্টক<input name="stock" type="number" min="0" step="1" value="0" required></label><button class="secondary" type="submit">ভ্যারিয়েন্ট যোগ করুন</button><p class="message pv2-variant-msg"></p></form><div class="table-wrap"><table><thead><tr><th>সাইজ</th><th>রং</th><th>SKU</th><th>দাম</th><th>স্টক</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+data.map(v=>'<tr data-variant="'+v.id+'"><td>'+esc(v.size||"—")+'</td><td>'+esc(v.color||"—")+'</td><td>'+esc(v.sku||"—")+'</td><td><input class="pv2-v-price" type="number" min="0" step="0.01" value="'+(v.price==null?"":Number(v.price))+'" placeholder="মূল দাম"></td><td><input class="pv2-v-stock" type="number" min="0" step="1" value="'+Number(v.stock_quantity||0)+'"></td><td>'+(v.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button type="button" class="secondary pv2-v-save">সংরক্ষণ</button> <button type="button" class="secondary pv2-v-toggle" data-active="'+v.is_active+'">'+(v.is_active?"বন্ধ":"চালু")+'</button> <button type="button" class="secondary pv2-v-delete">মুছুন</button></td></tr>').join("")+'</tbody></table></div>';
    box.querySelector(".pv2-variant-form").onsubmit=async ev=>{
     ev.preventDefault();const f=new FormData(ev.currentTarget),stock=Number(f.get("stock")),price=f.get("price")===""?null:Number(f.get("price"));
     if(!Number.isInteger(stock)||stock<0||(price!==null&&(!Number.isFinite(price)||price<0))){box.querySelector(".pv2-variant-msg").textContent="দাম বা স্টক সঠিক নয়।";return;}
     const {error}=await db.rpc("admin_add_product_variant",{p_product_id:tr.dataset.id,p_size:String(f.get("size")||"").trim()||null,p_color:String(f.get("color")||"").trim()||null,p_sku:String(f.get("sku")||"").trim()||null,p_price:price,p_stock_quantity:stock});
     box.querySelector(".pv2-variant-msg").textContent=error?"যোগ হয়নি: "+error.message:"ভ্যারিয়েন্ট যোগ হয়েছে।";if(!error)load();
    };
    box.querySelectorAll(".pv2-v-save").forEach(btn=>btn.onclick=async()=>{
     const row=btn.closest("tr"),priceText=row.querySelector(".pv2-v-price").value,stock=Number(row.querySelector(".pv2-v-stock").value),price=priceText===""?null:Number(priceText);
     if(!Number.isInteger(stock)||stock<0||(price!==null&&(!Number.isFinite(price)||price<0))){alert("দাম ও স্টক সঠিকভাবে দিন।");return;}
     const {error}=await db.from("product_variants").update({price,stock_quantity:stock}).eq("id",row.dataset.variant);if(error)alert(error.message);else load();
    });
    box.querySelectorAll(".pv2-v-toggle").forEach(btn=>btn.onclick=async()=>{const row=btn.closest("tr"),{error}=await db.from("product_variants").update({is_active:btn.dataset.active!=="true"}).eq("id",row.dataset.variant);if(error)alert(error.message);else load();});
    box.querySelectorAll(".pv2-v-delete").forEach(btn=>btn.onclick=async()=>{const row=btn.closest("tr");if(!confirm("এই ভ্যারিয়েন্ট মুছবেন?"))return;const {error}=await db.from("product_variants").delete().eq("id",row.dataset.variant);if(error)alert(error.message);else load();});
   };
   await load();
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
  el.innerHTML='<div class="module-kpis"><article><b>'+rows.length+'</b><span>সর্বশেষ ১০০০ ক্রেতা</span></article></div><div class="toolbar"><label>ক্রেতা খুঁজুন<input id="customerV2Search" placeholder="নাম, মোবাইল বা ইমেইল"></label><button id="customerV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div class="table-wrap"><table><thead><tr><th>নাম</th><th>মোবাইল</th><th>ইমেইল</th><th>যোগদানের তারিখ</th></tr></thead><tbody>'+normalized.map(c=>'<tr><td>'+esc(c.name||"—")+'</td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.email||"—")+'</td><td>'+esc(c.date?new Date(c.date).toLocaleDateString("bn-BD"):"—")+'</td></tr>').join("")+'</tbody></table></div>';
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


/* Security workspace: admin TOTP MFA enrollment + staff overview. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("securityPanel");if(!el)return;
  el.innerHTML='<p class="muted">নিরাপত্তা তথ্য লোড হচ্ছে…</p>';
  const [f,s]=await Promise.all([db.auth.mfa.listFactors(),db.from("staff_profiles").select("user_id,full_name,role,is_active,created_at").order("created_at",{ascending:false})]);
  if(f.error){el.innerHTML='<p class="error">MFA তথ্য পাওয়া যায়নি: '+esc(f.error.message)+'</p>';return;}
  if(s.error){el.innerHTML='<p class="error">স্টাফ তথ্য পাওয়া যায়নি: '+esc(s.error.message)+'</p>';return;}
  const verified=(f.data?.totp||[]).filter(x=>x.status==="verified");
  const aal=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  el.innerHTML='<h3>অ্যাডমিন লগইন নিরাপত্তা</h3><div class="module-kpis"><article><b>'+(verified.length?'চালু':'চালু নয়')+'</b><span>Authenticator OTP</span></article><article><b>'+esc(aal.data?.currentLevel||'—')+'</b><span>বর্তমান সেশন</span></article><article><b>'+esc(aal.data?.nextLevel||'—')+'</b><span>পরবর্তী নিরাপত্তা স্তর</span></article></div>'+
   '<p class="muted">Authenticator OTP চালু করলে পরবর্তী অ্যাডমিন লগইনে পাসওয়ার্ডের পর ৬ সংখ্যার কোড চাওয়া হবে। Google Account-এর 2-Step Verification আলাদা।</p>'+
   (verified.length?'<p class="success">Authenticator MFA চালু আছে।</p>':'<button id="mfaEnroll" class="primary" type="button">Authenticator OTP চালু করুন</button>')+
   '<div id="mfaSetup"></div><p id="mfaMsg" class="message" aria-live="polite"></p>'+
   '<h3>অ্যাডমিন ও স্টাফ</h3><div class="table-wrap"><table><thead><tr><th>নাম</th><th>ভূমিকা</th><th>অবস্থা</th></tr></thead><tbody>'+
   (s.data||[]).map(x=>'<tr><td>'+esc(x.full_name||'নাম নেই')+'</td><td>'+esc(x.role)+'</td><td>'+(x.is_active?'সক্রিয়':'নিষ্ক্রিয়')+'</td></tr>').join('')+
   '</tbody></table></div>';
  if(!verified.length){
   $("mfaEnroll").onclick=async()=>{
    const btn=$("mfaEnroll");btn.disabled=true;
    const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"I M SHOP Admin"});
    if(error){$("mfaMsg").textContent=error.message;btn.disabled=false;return;}
    $("mfaSetup").innerHTML='<h4>১. Authenticator অ্যাপে QR কোড স্ক্যান করুন</h4><img alt="Authenticator QR code" style="max-width:220px;background:white;padding:12px" src="'+esc(data.totp.qr_code)+'"><p>QR স্ক্যান না হলে Secret key লিখে যোগ করুন:</p><code>'+esc(data.totp.secret)+'</code><h4>২. অ্যাপের ৬ সংখ্যার কোড দিন</h4><form id="mfaVerifyForm"><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" required placeholder="৬ সংখ্যার OTP"><button class="primary" type="submit">OTP যাচাই ও চালু করুন</button></form>';
    $("mfaVerifyForm").onsubmit=async ev=>{ev.preventDefault();const code=String(new FormData(ev.currentTarget).get("code")).trim();const {data:ch,error:ce}=await db.auth.mfa.challenge({factorId:data.id});if(ce){$("mfaMsg").textContent=ce.message;return;}const {error:ve}=await db.auth.mfa.verify({factorId:data.id,challengeId:ch.id,code});$("mfaMsg").textContent=ve?"OTP যাচাই হয়নি: "+ve.message:"Authenticator MFA সফলভাবে চালু হয়েছে। পরবর্তী লগইন থেকে OTP লাগবে।";if(!ve)render();};
   };
  }
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="security"]'))setTimeout(()=>render().catch(err=>{const el=$("securityPanel");if(el)el.textContent=err.message;}),250);});
})();
/* Delivery and courier settings: courier_services + store_settings. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("deliveryPanel");if(!el)return;
  const [s,c]=await Promise.all([db.from("store_settings").select("setting_key,setting_value").in("setting_key",["dhaka_delivery_charge","outside_dhaka_delivery_charge"]),db.from("courier_services").select("id,name,is_active,settings").order("name")]);
  if(s.error||c.error){el.innerHTML='<p class="error">'+esc((s.error||c.error).message)+'</p>';return;}
  const v=Object.fromEntries((s.data||[]).map(x=>[x.setting_key,x.setting_value?.value??x.setting_value??""]));
  el.innerHTML='<form id="deliveryV3" class="module-form"><h3>ডেলিভারি চার্জ</h3><label>ঢাকার ভিতরে (৳)<input name="dhaka" type="number" min="0" value="'+esc(v.dhaka_delivery_charge??70)+'"></label><label>ঢাকার বাইরে (৳)<input name="outside" type="number" min="0" value="'+esc(v.outside_dhaka_delivery_charge??120)+'"></label><button class="primary">চার্জ সংরক্ষণ</button><p id="deliveryV3Msg"></p></form><h3>কুরিয়ার সার্ভিস</h3><form id="courierV3" class="module-form"><label>সার্ভিসের নাম<input name="name" required></label><button class="secondary">যোগ করুন</button></form><div class="table-wrap"><table><thead><tr><th>নাম</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (c.data||[]).map(x=>'<tr data-id="'+x.id+'"><td>'+esc(x.name)+'</td><td>'+(x.is_active?'সক্রিয়':'বন্ধ')+'</td><td><button class="secondary toggle">'+(x.is_active?'বন্ধ':'চালু')+'</button></td></tr>').join("")+'</tbody></table></div><p class="muted">চার্জ সেটিংসে সংরক্ষিত হয়। Checkout-এ স্বয়ংক্রিয় প্রয়োগ ও কুরিয়ার API সংযোগ আলাদা backend কাজ।</p>';
  $("deliveryV3").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),dhaka=Number(fd.get("dhaka")),outside=Number(fd.get("outside"));if(!Number.isFinite(dhaka)||dhaka<0||!Number.isFinite(outside)||outside<0){$("deliveryV3Msg").textContent="ডেলিভারি চার্জ শূন্য বা তার বেশি সংখ্যা হতে হবে।";return;}const rows=[{setting_key:"dhaka_delivery_charge",setting_value:{value:dhaka}},{setting_key:"outside_dhaka_delivery_charge",setting_value:{value:outside}}];const {error}=await db.from("store_settings").upsert(rows,{onConflict:"setting_key"});$("deliveryV3Msg").textContent=error?error.message:"চার্জ সংরক্ষিত হয়েছে";};
  $("courierV3").onsubmit=async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get("name")).trim();const {error}=await db.from("courier_services").insert({name,is_active:true,settings:{}});if(error)alert(error.message);else render();};
  el.querySelectorAll("tr[data-id] .toggle").forEach(btn=>btn.onclick=async()=>{const row=c.data.find(x=>x.id===btn.closest("tr").dataset.id);const {error}=await db.from("courier_services").update({is_active:!row.is_active}).eq("id",row.id);if(error)alert(error.message);else render();});
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="delivery"]'))setTimeout(()=>render().catch(err=>{$("deliveryPanel").textContent=err.message;}),400);});
})();

/* Payment transaction history: real payment_transactions table. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function render(){
  const el=$("paymentsPanel");if(!el)return;
  const {data,error}=await db.from("payment_transactions").select("id,order_id,provider,provider_reference,amount,status,created_at").order("created_at",{ascending:false}).limit(300);
  if(error){el.innerHTML='<p class="error">'+esc(error.message)+'</p>';return;}
  const rows=data||[],success=rows.filter(x=>String(x.status).toLowerCase()==="success").reduce((n,x)=>n+Number(x.amount||0),0);
  el.innerHTML='<div class="module-kpis"><article><b>'+rows.length+'</b><span>মোট লেনদেন</span></article><article><b>৳'+success.toLocaleString("en-BD")+'</b><span>সফল লেনদেন</span></article></div><div class="table-wrap"><table><thead><tr><th>প্রোভাইডার</th><th>পরিমাণ</th><th>স্ট্যাটাস</th><th>রেফারেন্স</th><th>তারিখ</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.provider)+'</td><td>৳'+Number(x.amount||0).toLocaleString("en-BD")+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.provider_reference||"—")+'</td><td>'+new Date(x.created_at).toLocaleString("bn-BD")+'</td></tr>').join("")+'</tbody></table></div><p class="muted">এখানে প্রকৃত payment_transactions ইতিহাস দেখা যাবে। bKash/Nagad/অনলাইন গেটওয়ে চালু করতে merchant credentials এবং নিরাপদ server-side callback প্রয়োজন।</p>';
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="payments"]'))setTimeout(()=>render().catch(err=>{$("paymentsPanel").textContent=err.message;}),400);});
})();

/* Marketing workspace v2: manage coupons and banners with safe validation, toggle and delete. */
(() => {
 const C=window.IMSHOP_CONFIG||{};if(!window.supabase||!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY)return;
 const db=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY),$=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=v=>"৳"+Number(v||0).toLocaleString("en-BD");
 async function render(){
  const el=$("marketingPanel");if(!el)return;
  const [c,b]=await Promise.all([db.from("coupons").select("*").order("created_at",{ascending:false}),db.from("store_banners").select("*").order("sort_order")]);
  if(c.error||b.error){el.innerHTML='<p class="error">মার্কেটিং ডেটা লোড হয়নি: '+esc((c.error||b.error).message)+'</p>';return;}
  el.innerHTML='<h3>ডিসকাউন্ট কুপন</h3><form id="couponV2Form" class="module-form"><label>কুপন কোড<input name="code" maxlength="40" required></label><label>ছাড়ের ধরন<select name="discount_type"><option value="fixed">নির্দিষ্ট টাকা</option><option value="percent">শতকরা</option></select></label><label>ছাড়ের পরিমাণ<input name="discount_value" type="number" min="0.01" step="0.01" required></label><label>ন্যূনতম অর্ডার<input name="minimum_order" type="number" min="0" value="0"></label><label>সর্বোচ্চ ব্যবহার<input name="usage_limit" type="number" min="1" placeholder="ঐচ্ছিক"></label><label>মেয়াদ শেষ<input name="expires_at" type="datetime-local"></label><button class="primary">কুপন তৈরি</button><p id="couponV2Msg" aria-live="polite"></p></form><div class="table-wrap"><table><thead><tr><th>কোড</th><th>ছাড়</th><th>ব্যবহার</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (c.data||[]).map(x=>'<tr data-coupon="'+esc(x.id)+'"><td>'+esc(x.code)+'</td><td>'+esc(x.discount_type==="percent"?x.discount_value+"%":money(x.discount_value))+'</td><td>'+Number(x.used_count||0)+'/'+(x.usage_limit??"∞")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary couponV2Toggle" type="button" data-on="'+!!x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button> <button class="secondary couponV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table></div><divider/><h3>স্টোর ব্যানার / স্লাইডার</h3><form id="bannerV2Form" class="module-form"><label>শিরোনাম<input name="title" required></label><label>ছবির URL<input name="image_url" type="url" required placeholder="https://..."></label><label>ক্লিক করলে যে লিংকে যাবে<input name="button_url" type="url" placeholder="ঐচ্ছিক"></label><label>প্রদর্শনের ক্রম<input name="sort_order" type="number" value="0"></label><button class="primary">ব্যানার যোগ করুন</button><p id="bannerV2Msg" aria-live="polite"></p></form><div class="table-wrap"><table><thead><tr><th>ব্যানার</th><th>ছবি</th><th>অবস্থা</th><th>কাজ</th></tr></thead><tbody>'+ (b.data||[]).map(x=>'<tr data-banner="'+esc(x.id)+'"><td>'+esc(x.title)+'</td><td>'+(x.image_url?'<a href="'+esc(x.image_url)+'" target="_blank" rel="noopener">ছবি দেখুন</a>':"—")+'</td><td>'+(x.is_active?"সক্রিয়":"বন্ধ")+'</td><td><button class="secondary bannerV2Toggle" type="button" data-on="'+!!x.is_active+'">'+(x.is_active?"বন্ধ":"চালু")+'</button> <button class="secondary bannerV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table></div><p class="muted">কুপন ও ব্যানার এখানে ডেটাবেসে সংরক্ষণ হয়। গ্রাহকের checkout-এ কুপন যাচাই/ছাড় প্রয়োগ এবং storefront-এ ব্যানার দেখানোর সংযোগ আলাদা ধাপে পরীক্ষা করতে হবে।</p>';
  $("couponV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),value=Number(fd.get("discount_value")),type=fd.get("discount_type");if(!Number.isFinite(value)||value<=0||(type==="percent"&&value>100)){ $("couponV2Msg").textContent="ছাড়ের পরিমাণ সঠিক নয়। শতকরা ছাড় ১০০-এর বেশি হতে পারবে না।";return;}const payload={code:String(fd.get("code")).trim().toUpperCase(),discount_type:type,discount_value:value,minimum_order:Math.max(0,Number(fd.get("minimum_order")||0)),usage_limit:fd.get("usage_limit")?Number(fd.get("usage_limit")):null,expires_at:fd.get("expires_at")?new Date(fd.get("expires_at")).toISOString():null};const {error}=await db.from("coupons").insert(payload);$("couponV2Msg").textContent=error?"কুপন তৈরি হয়নি: "+error.message:"কুপন তৈরি হয়েছে।";if(!error)render();};
  $("bannerV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const {error}=await db.from("store_banners").insert({title:String(fd.get("title")).trim(),image_url:fd.get("image_url"),button_url:fd.get("button_url")||null,sort_order:Number(fd.get("sort_order")||0),is_active:true});$("bannerV2Msg").textContent=error?"ব্যানার যোগ হয়নি: "+error.message:"ব্যানার যোগ হয়েছে।";if(!error)render();};
  el.querySelectorAll("tr[data-coupon]").forEach(tr=>{const id=tr.dataset.coupon;tr.querySelector(".couponV2Toggle").onclick=async ev=>{const btn=ev.currentTarget;const {error}=await db.from("coupons").update({is_active:btn.dataset.on!=="true"}).eq("id",id);if(error)alert("কুপন আপডেট হয়নি: "+error.message);else render();};tr.querySelector(".couponV2Delete").onclick=async()=>{if(!confirm("কুপনটি মুছবেন?"))return;const {error}=await db.from("coupons").delete().eq("id",id);if(error)alert("কুপন মুছা যায়নি: "+error.message);else render();};});
  el.querySelectorAll("tr[data-banner]").forEach(tr=>{const id=tr.dataset.banner;tr.querySelector(".bannerV2Toggle").onclick=async ev=>{const btn=ev.currentTarget;const {error}=await db.from("store_banners").update({is_active:btn.dataset.on!=="true"}).eq("id",id);if(error)alert("ব্যানার আপডেট হয়নি: "+error.message);else render();};tr.querySelector(".bannerV2Delete").onclick=async()=>{if(!confirm("ব্যানারটি মুছবেন?"))return;const {error}=await db.from("store_banners").delete().eq("id",id);if(error)alert("ব্যানার মুছা যায়নি: "+error.message);else render();};});
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
  const {data,error}=await db.from("notifications").select("id,title,message,notification_type,target_audience,is_active,created_at").order("created_at",{ascending:false}).limit(500);
  if(error){el.innerHTML='<p class="error">নোটিফিকেশন লোড হয়নি: '+esc(error.message)+'</p>';return;}
  const rows=data||[];
  el.innerHTML='<form id="noticeV2Form" class="module-form"><h3>নতুন অ্যাডমিন নোটিফিকেশন</h3><label>শিরোনাম<input name="title" required maxlength="150"></label><label>বিস্তারিত বার্তা<textarea name="message" rows="3" required maxlength="3000"></textarea></label><button class="primary">নোটিফিকেশন তৈরি</button><p id="noticeV2Msg" aria-live="polite"></p></form><div class="toolbar"><label>নোটিফিকেশন খুঁজুন<input id="noticeV2Search" placeholder="শিরোনাম বা বার্তা"></label><button id="noticeV2Export" class="secondary" type="button">CSV ডাউনলোড</button></div><div id="noticeV2List" class="table-wrap"></div><p class="muted">এগুলো অ্যাডমিন প্যানেলের নোটিশ। গ্রাহকের ফোনে push notification বা SMS পাঠাতে আলাদা provider ও অনুমতি কনফিগার করতে হবে।</p>';
  function draw(){const q=$("noticeV2Search").value.toLowerCase(),filtered=rows.filter(x=>(x.title||"").toLowerCase().includes(q)||(x.message||"").toLowerCase().includes(q));$("noticeV2List").innerHTML='<table><thead><tr><th>শিরোনাম</th><th>বার্তা</th><th>তারিখ</th><th>কাজ</th></tr></thead><tbody>'+filtered.map(x=>'<tr data-notice="'+esc(x.id)+'"><td>'+esc(x.title)+'</td><td>'+esc(x.message)+'</td><td>'+esc(x.created_at?new Date(x.created_at).toLocaleString("bn-BD"):"—")+'</td><td><button class="secondary noticeV2Delete" type="button">মুছুন</button></td></tr>').join("")+'</tbody></table>';el.querySelectorAll(".noticeV2Delete").forEach(btn=>btn.onclick=async()=>{const id=btn.closest("tr").dataset.notice;if(!confirm("এই নোটিফিকেশনটি মুছবেন?"))return;const {error}=await db.from("notifications").delete().eq("id",id);if(error)alert("মুছা যায়নি: "+error.message);else{const at=rows.findIndex(x=>x.id===id);if(at>=0)rows.splice(at,1);draw();}});}
  $("noticeV2Search").oninput=draw;
  $("noticeV2Export").onclick=()=>{const lines=[["Title","Message","Created"],...rows.map(x=>[x.title,x.message,x.created_at])],csv=lines.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");a.href=url;a.download="im-shop-notifications.csv";a.click();URL.revokeObjectURL(url);};
  $("noticeV2Form").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const {error}=await db.from("notifications").insert({title:String(fd.get("title")).trim(),message:String(fd.get("message")).trim()});$("noticeV2Msg").textContent=error?"নোটিফিকেশন তৈরি হয়নি: "+error.message:"নোটিফিকেশন তৈরি হয়েছে।";if(!error){const {data}=await db.from("notifications").select("id,title,message,notification_type,target_audience,is_active,created_at").order("created_at",{ascending:false}).limit(500);if(data){rows.splice(0,rows.length,...data);draw();ev.currentTarget.reset();}}};
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
  const {data,error}=await db.from("store_settings").select("setting_key,setting_value");
  if(error){el.innerHTML='<p class="error">সেটিংস লোড হয়নি: '+esc(error.message)+'। ডেটাবেসে store_settings টেবিল ও Admin write policy নিশ্চিত করতে হবে।</p>';return;}
  const v=Object.fromEntries((data||[]).map(x=>[x.setting_key,x.setting_value?.value??x.setting_value??""]));
  const fields=[["store_name","দোকানের নাম","I M SHOP"],["phone","যোগাযোগের মোবাইল",""],["support_email","সাপোর্ট ইমেইল",""],["address","দোকানের ঠিকানা",""],["dhaka_delivery_charge","ঢাকার ডেলিভারি চার্জ (৳)","70"],["outside_dhaka_delivery_charge","ঢাকার বাইরের ডেলিভারি চার্জ (৳)","120"],["currency","মুদ্রা","BDT"],["order_prefix","অর্ডার নম্বরের প্রিফিক্স","IM"]];
  el.innerHTML='<form id="storeSettingsV2" class="module-form"><h3>দোকানের পরিচিতি</h3>'+fields.map(([k,label,def])=>'<label>'+label+'<input name="'+k+'" '+(["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(k)?'type="number" min="0" step="1"':'')+' value="'+esc(v[k]??def)+'" '+(k==="store_name"?"required":"")+'></label>').join("")+'<button class="primary" type="submit">সব সেটিংস সংরক্ষণ</button><p id="storeSettingsV2Msg" aria-live="polite"></p></form><p class="muted">এই মানগুলো অ্যাডমিন সেটিংসে সংরক্ষিত হবে। ডেলিভারি চার্জ Checkout-এ স্বয়ংক্রিয়ভাবে প্রয়োগ হচ্ছে—এমন নয়; সেটি অর্ডার তৈরির backend-এ আলাদাভাবে যুক্ত ও পরীক্ষা করতে হবে।';
  $("storeSettingsV2").onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget);const payload=fields.map(([key])=>({setting_key:key,setting_value:{value:["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(key)?Number(fd.get(key)):String(fd.get(key)||"").trim()},updated_at:new Date().toISOString()}));for(const row of payload){if(["dhaka_delivery_charge","outside_dhaka_delivery_charge"].includes(row.setting_key)&&(!Number.isFinite(row.setting_value.value)||row.setting_value.value<0)){$("storeSettingsV2Msg").textContent="ডেলিভারি চার্জ শূন্য বা তার বেশি সংখ্যা হতে হবে।";return;}}const {error}=await db.from("store_settings").upsert(payload,{onConflict:"setting_key"});$("storeSettingsV2Msg").textContent=error?"সংরক্ষণ হয়নি: "+error.message:"দোকানের সেটিংস সার্ভারে সংরক্ষিত হয়েছে।";};
 }
 document.getElementById("sideNav")?.addEventListener("click",e=>{if(e.target.closest('[data-page="settings"]'))setTimeout(()=>render().catch(err=>{const el=$("settingsPanel");if(el)el.textContent=err.message;}),1600);});
})();
