// 2026-10-23 23:15 変更済み
// このファイル全体を Google Apps Script の「コード.gs」へ貼り付けます。
// 下の秘密キーだけ、自分で作った長い文字列へ置き換えてください。
const SHARED_SECRET = "ここをCloudflareと同じ長い秘密キーに置き換える";

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function emailList(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map(function (recipient) {
      return recipient && validEmail(recipient.email) ? recipient.email : "";
    })
    .filter(Boolean)
    .join(",");
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "福林楼 Gmail 自動送信",
    message: "接続先は動作しています。",
  });
}

function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET") || SHARED_SECRET;
    if (!secret || secret === "ここをCloudflareと同じ長い秘密キーに置き換える" || data.secret !== secret) {
      return jsonResponse({ ok: false, error: "秘密キーが一致しません。" });
    }

    if (data.action === "calendar.create" || data.action === "calendar.delete") return jsonResponse(calendarAction(data));

    const to = emailList(data.to);
    const cc = emailList(data.cc);
    const replyTo = validEmail(data.replyTo) ? data.replyTo : "";
    const subject = String(data.subject || "").slice(0, 250);
    const text = String(data.text || "").slice(0, 50000);
    const html = String(data.html || "").slice(0, 100000);
    const senderEmail = validEmail(data.senderEmail) ? data.senderEmail.toLowerCase() : "";
    const senderName = String(data.senderName || "中国料理 福林楼").slice(0, 80);

    if (!to || !subject || !text) {
      return jsonResponse({ ok: false, error: "宛先・件名・本文が不足しています。" });
    }

    const options = {
      name: senderName,
      htmlBody: html || text,
    };
    if (senderEmail) {
      const primaryEmail = String(Session.getEffectiveUser().getEmail() || "").toLowerCase();
      const aliases = GmailApp.getAliases().map(function (email) {
        return String(email).toLowerCase();
      });
      if (senderEmail !== primaryEmail && aliases.indexOf(senderEmail) === -1) {
        return jsonResponse({
          ok: false,
          error:
            "指定した送信元メールはこのGmailから送信できません。Gmailに送信元エイリアスとして登録するか、管理画面の送信元を空欄にしてください。",
        });
      }
      if (aliases.indexOf(senderEmail) !== -1) options.from = senderEmail;
    }
    if (cc) options.cc = cc;
    if (replyTo) options.replyTo = replyTo;

    GmailApp.sendEmail(to, subject, text, options);
    return jsonResponse({ ok: true, messageId: "gmail-" + Utilities.getUuid() });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : "Gmail送信に失敗しました。",
    });
  }
}

/** 店舗アカウントでの権限承認用。予定は作成・削除しません。 */
function authorizeServices() {
  GmailApp.getAliases();
  const id = PropertiesService.getScriptProperties().getProperty("GOOGLE_CALENDAR_ID") || "hakata.fulinlou@gmail.com";
  const calendar = CalendarApp.getCalendarById(id);
  if (!calendar) throw new Error("カレンダーにアクセスできません。店舗アカウント・カレンダーIDを確認してください。");
  calendar.getName();
  if (Session.getScriptTimeZone() !== "Asia/Tokyo") throw new Error("Apps ScriptのタイムゾーンをAsia/Tokyoにしてください。");
}
function calendarAction(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("ほかの予約と同期中です。管理画面から再同期してください。");
  try {
    if (Session.getScriptTimeZone() !== "Asia/Tokyo") throw new Error("Apps ScriptのタイムゾーンをAsia/Tokyoにしてください。");
    const props=PropertiesService.getScriptProperties();
    const calendarId=String(data.calendarId||props.getProperty("GOOGLE_CALENDAR_ID")||"hakata.fulinlou@gmail.com");
    const calendar=CalendarApp.getCalendarById(calendarId);
    if(!calendar) throw new Error("カレンダーにアクセスできません。店舗アカウント・カレンダーID・権限を確認してください。");
    const key=String(data.eventKey||data.publicRef||"");
    if(!key&&!data.eventId) throw new Error("予定を識別できません。");
    const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,calendarId+"|"+key);
    const property=key?"calendar-event:"+Utilities.base64EncodeWebSafe(digest):"";
    const stored=property?props.getProperty(property):"";
    let event=(stored&&calendar.getEventById(stored))||(data.eventId&&calendar.getEventById(String(data.eventId)))||null;
    if(data.action==="calendar.delete") {
      if(event) event.deleteEvent();
      if(property) props.deleteProperty(property);
      return {ok:true};
    }
    const title=String(data.title||"").slice(0,500),description=String(data.description||"").slice(0,8000),colorId=String(data.colorId||"9");
    if(!title||!/^(?:[1-9]|10|11)$/.test(colorId)) throw new Error("予定のタイトルまたは色が正しくありません。");
    if(data.allDayDate) {
      const day=String(data.allDayDate),date=new Date(day+"T00:00:00+09:00");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||isNaN(date.getTime())||Utilities.formatDate(date,"Asia/Tokyo","yyyy-MM-dd")!==day) throw new Error("受取日が正しくありません。");
      if(event) event.setAllDayDate(date);
      else event=calendar.createAllDayEvent(title,date,{description:description});
    } else {
      const start=new Date(String(data.start)),end=new Date(String(data.end));
      if(isNaN(start.getTime())||isNaN(end.getTime())||start>=end) throw new Error("予定の日時が正しくありません。");
      if(event) event.setTime(start,end);
      else event=calendar.createEvent(title,start,end,{description:description});
    }
    if(property) props.setProperty(property,event.getId());
    event.setTitle(title).setDescription(description).setColor(colorId);
    return {ok:true,eventId:event.getId()};
  } finally {lock.releaseLock();}
}

