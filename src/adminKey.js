export function getAdminKeyFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get("key") || params.get("adminKey") || "";
}
