let domaineName = window.location.hostname
export let socket = new WebSocket(`ws:${domaineName}:8081`);
