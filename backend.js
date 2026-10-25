/* Public routing only. Credentials and account limits stay on the server. */
(function(root){
  'use strict';
  const functions=new Set(['features','live-audio','examples','tts','admin-badges','stories','billing','maintenance','announcements']);
  const github=root.location.origin==='https://muhammedfidann06.github.io' &&
    (root.location.pathname==='/lumira' || root.location.pathname.startsWith('/lumira/'));
  const base=(github?'https://lumira-tr.com':'')+'/.netlify/functions/';
  root.LUMIRA_BACKEND=Object.freeze({
    url(name){if(!functions.has(name))throw new TypeError('Unknown Lumira function');return base+name;}
  });
})(window);
