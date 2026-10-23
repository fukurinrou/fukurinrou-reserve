// 2026-10-23 23:15 変更済み
const EVENT_TABLE = `CREATE TABLE IF NOT EXISTS calendar_sync_events (
  reservation_type TEXT NOT NULL,reservation_id INTEGER NOT NULL,public_ref TEXT NOT NULL,
  calendar_event_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(reservation_type,reservation_id))`;
const STATUS_TABLE = `CREATE TABLE IF NOT EXISTS course_calendar_status (
  reservation_id INTEGER PRIMARY KEY,state TEXT NOT NULL,message TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`;
function message(error) {
  const text = error instanceof Error ? error.message : String(error);
  if (/does not have permission|Required permissions|Authorization is required/i.test(text)) return "Googleカレンダーの権限が未承認です。Apps ScriptでauthorizeServicesを実行して承認後、再同期してください。";
  if (/timed out|timeout|aborted/i.test(text)) return "Googleカレンダーへの接続が中断しました。予約は保存済みです。管理画面から再同期してください。";
  return text.slice(0,400);
}
export function courseEvent(item) {
  const start = new Date(`${item.reservation_date}T${item.reservation_time}:00+09:00`);
  if (Number.isNaN(start.getTime())) throw new Error("予約日時を確認してください。");
  const course = item.reservation_type === "コース料理";
  return {
    eventKey: `course:${item.id}:${item.public_ref}`,publicRef:item.public_ref,
    title:`【${course ? "コース予約" : "席予約"}】${item.customer_name}様・${item.people}名${course && item.course_name ? "｜"+item.course_name : ""}`,
    start:start.toISOString(),end:new Date(start.getTime()+2*3600000).toISOString(),colorId:course?"3":"9",
    description:[`受付番号：${item.public_ref}`,`お名前：${item.customer_name}`,`電話：${item.customer_phone}`,`メール：${item.customer_email}`,
      `来店予定：${item.reservation_date} ${item.reservation_time}`,`人数：${item.people}名`,`お席の希望：${item.seat_preference || "特になし"}`,
      item.course_name?`コース：${item.course_name}`:"",item.drink_plan?`飲み物：${item.drink_plan}`:"",item.total_amount?`合計：${item.total_amount}`:"",item.course_dishes?`料理：${item.course_dishes}`:"",
      `受付状態：${({new:"仮受付",handled:"対応済み",paid:"会計済み",complete:"完了"})[item.status]||item.status}`,
      "カレンダー上は2時間の予定枠です。実際のご利用時間は店舗でご案内します。",item.notes?`ご要望：${item.notes}`:""].filter(Boolean).join("\n"),
  };
}
async function requestCalendar(env,action,payload) {
  const url = String(env.GMAIL_APPS_SCRIPT_URL || ""),secret = String(env.GMAIL_APPS_SCRIPT_SECRET || "");
  let endpoint;
  try { endpoint=new URL(url); } catch { throw new Error("Gmail連携URLを確認してください。"); }
  if(endpoint.protocol!=="https:"||endpoint.hostname!=="script.google.com"||!endpoint.pathname.startsWith("/macros/s/")||!endpoint.pathname.endsWith("/exec")) throw new Error("Gmail連携にはApps Scriptの/exec URLを指定してください。");
  const response=await fetch(endpoint.toString(),{method:"POST",redirect:"follow",signal:AbortSignal.timeout(25000),headers:{"content-type":"application/json"},body:JSON.stringify({secret,action,calendarId:env.GOOGLE_CALENDAR_ID||"hakata.fulinlou@gmail.com",...payload})});
  let result;
  try { result=JSON.parse(await response.text()); } catch { throw new Error("Apps Scriptの公開範囲・/exec URLを確認してください。"); }
  if(!response.ok||!result.ok) throw new Error(result.error||"Googleカレンダーを更新できませんでした。");
  return result;
}
export async function syncCourseToCalendar(env,item) {
  let result;
  try {
    await env.DB.prepare(EVENT_TABLE).run();
    if(!env.GMAIL_APPS_SCRIPT_URL||!env.GMAIL_APPS_SCRIPT_SECRET) result={state:"not_configured",message:"Googleカレンダー連携が未設定です。予約は保存されています。"};
    else {
      const old=await env.DB.prepare("SELECT calendar_event_id FROM calendar_sync_events WHERE reservation_type='course' AND reservation_id=?").bind(item.id).first();
      const eventKey=`course:${item.id}:${item.public_ref}`;
      if(item.status==="cancelled"||item.trashed_at) {
        await requestCalendar(env,"calendar.delete",{eventKey,eventId:old?.calendar_event_id});
        await env.DB.prepare("DELETE FROM calendar_sync_events WHERE reservation_type='course' AND reservation_id=?").bind(item.id).run();
        result={state:"cancelled",message:"Googleカレンダーから削除済み"};
      } else {
        const response=await requestCalendar(env,"calendar.create",{...courseEvent(item),eventId:old?.calendar_event_id});
        if(!response.eventId) throw new Error("Googleカレンダーの予定IDを取得できませんでした。");
        await env.DB.prepare(`INSERT INTO calendar_sync_events (reservation_type,reservation_id,public_ref,calendar_event_id) VALUES ('course',?,?,?)
          ON CONFLICT(reservation_type,reservation_id) DO UPDATE SET public_ref=excluded.public_ref,calendar_event_id=excluded.calendar_event_id`)
          .bind(item.id,item.public_ref,response.eventId).run();
        result={state:"synced",message:"Googleカレンダー登録済み"};
      }
    }
  } catch(error) { console.error("Course calendar sync failed",error); result={state:"error",message:message(error)}; }
  try {
    await env.DB.prepare(STATUS_TABLE).run();
    await env.DB.prepare(`INSERT INTO course_calendar_status (reservation_id,state,message,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(reservation_id) DO UPDATE SET state=excluded.state,message=excluded.message,updated_at=excluded.updated_at`)
      .bind(item.id,result.state,result.message,new Date().toISOString()).run();
  } catch(error) { console.error("Course calendar status save failed",error); }
  return result;
}
