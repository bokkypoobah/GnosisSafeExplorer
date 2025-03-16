const ADDRESS0 = "0x0000000000000000000000000000000000000000";

const delay = ms => new Promise(res => setTimeout(res, ms));

function handleErrors(response) {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
}

function now() {
  return moment().format("HH:mm:ss");
}
function formatLocalTime(t) {
  return moment.unix(t).format("YYYY-MM-DD HH:mm:ss");
}
