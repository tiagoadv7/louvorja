// Deriva os links clicáveis (ícone + url + rótulo legível) de um colaborador
// (ver src/config/Contributors.js), usado pelas linhas do "Sobre"
// (AboutDialog.vue).
export function contributorLinks(c) {
  const links = [];
  if (c.github) links.push({ icon: 'mdi-github', url: `https://github.com/${c.github}`, label: `github.com/${c.github}` });
  if (c.linkedin) links.push({ icon: 'mdi-linkedin', url: `https://linkedin.com/in/${c.linkedin}`, label: `linkedin.com/in/${c.linkedin}`, color: '#0A66C2' });
  if (c.facebook) {
    const url = c.facebook.startsWith('http') ? c.facebook : `https://facebook.com/${c.facebook}`;
    links.push({ icon: 'mdi-facebook', url, label: url.replace(/^https?:\/\//, ''), color: 'blue' });
  }
  if (c.instagram) links.push({ icon: 'mdi-instagram', url: `https://instagram.com/${c.instagram}`, label: `instagram.com/${c.instagram}`, color: 'purple' });
  if (c.x) links.push({ icon: 'mdi-twitter', url: `https://x.com/${c.x}`, label: `x.com/${c.x}` });
  if (c.website) links.push({ icon: 'mdi-web', url: c.website, label: c.website.replace(/^https?:\/\//, '') });
  if (c.whatsapp) links.push({ icon: 'mdi-whatsapp', url: `https://wa.me/${c.whatsapp}`, label: 'WhatsApp', color: 'green' });
  if (c.website2) links.push({ icon: 'mdi-web', url: c.website2, label: c.website2.replace(/^https?:\/\//, '') });
  if (c.email) links.push({ icon: 'mdi-email-outline', url: `mailto:${c.email}`, label: c.email });
  return links;
}
