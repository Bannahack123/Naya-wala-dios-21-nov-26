export async function onRequest(context: any) {
  try {
    const apiRes = await fetch("https://scaling-computing-machine-p4p47p4r54qcr7jq-8000.app.github.dev/api/load-local-csv");
    const data = await apiRes.text();
    return new Response(data, { status: apiRes.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
