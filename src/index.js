// 2026-09-08 23:55 変更済み
const headers = {"content-type":"application/json; charset=utf-8"};
function reply(body, status=200){ return new Response(JSON.stringify(body), {status, headers}); }
function clean(value, max){ return typeof value === "string" ? value.trim().slice(0,max) : ""; }
function ref(){ return `C-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`; }
function validTime(value){ return ["13:00","13:30","14:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"].includes(value); }
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if(request.method === "POST" && url.pathname === "/api/reservations"){
    const p = await request.json(); const name=clean(p.name,80), email=clean(p.email,180).toLowerCase(), tel=clean(p.tel,30), date=clean(p.date,10), time=clean(p.time,5), rtype=clean(p.rtype,30), people=Number(p.people);
    if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !tel || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTime(time) || !Number.isInteger(people) || people<1 || people>45) return reply({error:"必須項目を確認してください。"},400);
    const at = new Date(`${date}T${time}:00+09:00`); if(at.getTime() < Date.now()+3600000) return reply({error:"当日のご予約は、希望時刻の1時間前までです。"},400);
    if(rtype === "コース料理" && clean(p.course,80) === "家族コース" && (people<2 || people>4)) return reply({error:"家族コースは2〜4名様でお選びください。"},400);
    const publicRef=ref(); await env.DB.prepare(`INSERT INTO course_reservations (public_ref,reservation_type,customer_name,customer_email,customer_phone,people,reservation_date,reservation_time,seat_preference,course_name,drink_plan,per_person_amount,total_amount,course_dishes,notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'new')`).bind(publicRef,rtype,name,email,tel,people,date,time,clean(p.seat,100),clean(p.course,100),clean(p.drink_plan,160),clean(p.course_price,120),clean(p.reservation_amount,80),clean(p.course_dishes,2000),clean(p.note,1000)).run(); return reply({ok:true,publicRef},201);
  }
  if(request.method === "POST" && url.pathname === "/api/cancellations"){
    const p=await request.json(); const name=clean(p.name,80),email=clean(p.email,180).toLowerCase(),tel=clean(p.tel,30); if(!name||!email||!tel)return reply({error:"お名前・メールアドレス・電話番号を入力してください。"},400);
    const row=await env.DB.prepare(`SELECT id, public_ref FROM course_reservations WHERE customer_name=? AND customer_email=? AND customer_phone=? AND status!='cancelled' ORDER BY reservation_date DESC, id DESC LIMIT 1`).bind(name,email,tel).first(); if(!row)return reply({error:"一致する予約が見つかりませんでした。"},404); await env.DB.prepare(`UPDATE course_reservations SET status='cancelled', cancelled_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run(); return reply({ok:true,publicRef:row.public_ref});
  }
  return env.ASSETS.fetch(request);
} };
