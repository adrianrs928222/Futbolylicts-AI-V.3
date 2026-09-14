const baseUrl = process.env.APP_BASE_URL;
if (!baseUrl) throw new Error("Falta APP_BASE_URL, por ejemplo https://tu-app.onrender.com");
const secret = process.env.ML_CRON_SECRET;
const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/ml/learn`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(secret ? { "x-ml-secret": secret } : {}) },
  body: JSON.stringify({}),
});
const text = await response.text();
if (!response.ok) throw new Error(`ML endpoint ${response.status}: ${text}`);
console.log(text);
