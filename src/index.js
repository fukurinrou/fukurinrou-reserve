// 2026-09-09 11:20 変更済み
const headers = { "content-type": "application/json; charset=utf-8" };

const defaultCourseSettings = {
  introText:
    "博多駅から徒歩約10分。お席のみのご予約から、コース料理のご予約まで承ります。ご希望の内容をお選びのうえ、フォームよりお申し込みください。",
  courseNotice:
    "福林コース・招福コースは3名様から、家族コースは2〜4名様で承ります。コース料理のご予約は午後の時間帯をお選びください。",
  decemberNotice:
    "年末年始はご予約を承れない場合があります。その場合、080-3981-1369からお電話することがありますので、あらかじめご了承ください。",
  regularAlcoholAmount: 2000,
  familyAlcoholAmount: 2500,
  softDrinkAmount: 500,
  courses: [
    { name: "福林コース", amount: 3000, priceType: "perPerson", minPeople: 3, maxPeople: 45, dishes: ["前菜4種", "エビチリソース 🌶️", "我が家の酢豚", "揚げ物2種（鶏唐揚げ・春巻き）", "手作り焼き餃子", "マーボー豆腐 🌶️🌶️🌶️", "チャーハン", "玉子スープ", "日替わりデザート"] },
    { name: "招福コース", amount: 3500, priceType: "perPerson", minPeople: 3, maxPeople: 45, dishes: ["前菜5種", "大きなエビチリソース 🌶️", "我が家の酢豚", "揚げ物2種（鶏唐揚げ・春巻き）", "手作り焼き餃子", "海鮮三種炒め", "ピーマンと牛肉の炒め", "チャーハン", "フカヒレスープ", "日替わりデザート"] },
    { name: "家族コース", amount: 5800, priceType: "fixed", minPeople: 2, maxPeople: 4, dishes: ["前菜3種", "油淋鶏（揚げ鶏肉のネギ醤油かけ）", "チャーハン", "マーボー豆腐 🌶️🌶️🌶️", "エビのチリソース炒め 🌶️", "焼き餃子", "玉子スープ"] },
  ],
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function reference() {
  return `C-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function validTime(value) {
  return ["13:00", "13:30", "14:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"].includes(value);
}

function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const rawCourses = Array.isArray(source.courses) ? source.courses : [];
  const courses = rawCourses.slice(0, 6).map((item, index) => {
    const fallback = defaultCourseSettings.courses[index] || defaultCourseSettings.courses[0];
    const row = item && typeof item === "object" ? item : {};
    const minPeople = number(row.minPeople, fallback.minPeople, 1, 45);
    return {
      name: clean(row.name, 60) || fallback.name,
      amount: number(row.amount, fallback.amount, 0, 100000),
      priceType: row.priceType === "fixed" ? "fixed" : row.priceType === "perPerson" ? "perPerson" : fallback.priceType,
      minPeople,
      maxPeople: Math.max(minPeople, number(row.maxPeople, fallback.maxPeople, 1, 45)),
      dishes: (Array.isArray(row.dishes) ? row.dishes : fallback.dishes).slice(0, 20).map((dish) => clean(String(dish), 120)).filter(Boolean),
    };
  });
  return {
    introText: clean(source.introText, 500) || defaultCourseSettings.introText,
    courseNotice: clean(source.courseNotice, 500) || defaultCourseSettings.courseNotice,
    decemberNotice: clean(source.decemberNotice, 500) || defaultCourseSettings.decemberNotice,
    regularAlcoholAmount: number(source.regularAlcoholAmount, defaultCourseSettings.regularAlcoholAmount, 0, 100000),
    familyAlcoholAmount: number(source.familyAlcoholAmount, defaultCourseSettings.familyAlcoholAmount, 0, 100000),
    softDrinkAmount: number(source.softDrinkAmount, defaultCourseSettings.softDrinkAmount, 0, 100000),
    courses: courses.length ? courses : defaultCourseSettings.courses,
  };
}

async function getCourseSettings(env) {
  try {
    const row = await env.DB.prepare("SELECT content_json FROM course_site_settings WHERE id=1").first();
    return row?.content_json ? normalizeSettings(JSON.parse(row.content_json)) : defaultCourseSettings;
  } catch {
    return defaultCourseSettings;
  }
}

function yen(amount) {
  return `￥${Number(amount).toLocaleString("ja-JP")}`;
}

function calculatePrice(settings, course, people, drinkId) {
  const courseAmount = course.priceType === "fixed" ? course.amount : course.amount * people;
  const drinkAmount = drinkId === "alcohol"
    ? (course.priceType === "fixed" ? settings.familyAlcoholAmount : settings.regularAlcoholAmount) * people
    : drinkId === "softdrink"
      ? settings.softDrinkAmount * people
      : 0;
  const drinkLabel = drinkId === "alcohol"
    ? "2時間飲み放題（90分オーダーストップ）"
    : drinkId === "softdrink"
      ? "ソフトドリンク飲み放題"
      : "希望しない";
  const total = courseAmount + drinkAmount;
  return {
    total,
    perPerson: Math.round(total / people),
    drinkLabel,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/course-settings") {
      return reply({ settings: await getCourseSettings(env) });
    }

    if (request.method === "POST" && url.pathname === "/api/reservations") {
      const payload = await request.json();
      const name = clean(payload.name, 80);
      const email = clean(payload.email, 180).toLowerCase();
      const tel = clean(payload.tel, 30);
      const date = clean(payload.date, 10);
      const time = clean(payload.time, 5);
      const reservationType = clean(payload.rtype, 30);
      const people = Number(payload.people);

      if (
        !name ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !tel ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !validTime(time) ||
        !Number.isInteger(people) ||
        people < 1 ||
        people > 45
      ) {
        return reply({ error: "必須項目を確認してください。" }, 400);
      }

      const requestedAt = new Date(`${date}T${time}:00+09:00`);
      if (requestedAt.getTime() < Date.now() + 60 * 60 * 1000) {
        return reply({ error: "当日のご予約は、希望時刻の1時間前までです。" }, 400);
      }

      const settings = await getCourseSettings(env);
      const courseName = clean(payload.course, 100);
      const selectedCourse = reservationType === "コース料理" ? settings.courses.find((course) => course.name === courseName) : null;
      const drinkId = ["none", "alcohol", "softdrink"].includes(payload.drink_id) ? payload.drink_id : "none";

      if (reservationType === "コース料理" && selectedCourse && (people < selectedCourse.minPeople || people > selectedCourse.maxPeople)) {
        return reply({ error: `${selectedCourse.name}は${selectedCourse.minPeople}〜${selectedCourse.maxPeople}名様でお選びください。` }, 400);
      }

      const price = selectedCourse ? calculatePrice(settings, selectedCourse, people, drinkId) : null;
      const publicRef = reference();
      await env.DB.prepare(
        "INSERT INTO course_reservations (public_ref,reservation_type,customer_name,customer_email,customer_phone,people,reservation_date,reservation_time,seat_preference,course_name,drink_plan,per_person_amount,total_amount,course_dishes,notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'new')",
      )
        .bind(
          publicRef,
          reservationType,
          name,
          email,
          tel,
          people,
          date,
          time,
          clean(payload.seat, 100),
          courseName,
          price ? price.drinkLabel : clean(payload.drink_plan, 160),
          price ? yen(price.perPerson) : clean(payload.course_price, 120),
          price ? yen(price.total) : clean(payload.reservation_amount, 80),
          selectedCourse ? selectedCourse.dishes.join(" / ") : clean(payload.course_dishes, 2000),
          clean(payload.note, 1000),
        )
        .run();

      return reply({ ok: true, publicRef }, 201);
    }

    if (request.method === "POST" && url.pathname === "/api/cancellations") {
      const payload = await request.json();
      const name = clean(payload.name, 80);
      const email = clean(payload.email, 180).toLowerCase();
      const tel = clean(payload.tel, 30);
      if (!name || !email || !tel) return reply({ error: "お名前・メールアドレス・電話番号を入力してください。" }, 400);

      const row = await env.DB.prepare(
        "SELECT id, public_ref FROM course_reservations WHERE customer_name=? AND customer_email=? AND customer_phone=? AND status!='cancelled' AND trashed_at IS NULL ORDER BY reservation_date DESC, id DESC LIMIT 1",
      )
        .bind(name, email, tel)
        .first();
      if (!row) return reply({ error: "一致する予約が見つかりませんでした。" }, 404);

      await env.DB.prepare("UPDATE course_reservations SET status='cancelled', cancelled_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(row.id)
        .run();
      return reply({ ok: true, publicRef: row.public_ref });
    }

    return env.ASSETS.fetch(request);
  },
};
