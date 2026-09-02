// Deriva os links clicáveis de um colaborador (ver src/config/Contributors.js)
// — usado tanto pelo card grande (ContributorCard.vue) quanto pelas linhas
// compactas do "Sobre" (AboutDialog.vue), pra não duplicar esse mapeamento
// ícone/URL nos dois lugares.
export function contributorLinks(c) {
  const links = [];
  if (c.github) links.push({ icon: 'mdi-github', url: `https://github.com/${c.github}` });
  if (c.linkedin) links.push({ icon: 'mdi-linkedin', url: `https://linkedin.com/in/${c.linkedin}` });
  if (c.facebook) {
    links.push({
      icon: 'mdi-facebook',
      url: c.facebook.startsWith('http') ? c.facebook : `https://facebook.com/${c.facebook}`,
    });
  }
  if (c.instagram) links.push({ icon: 'mdi-instagram', url: `https://instagram.com/${c.instagram}` });
  if (c.x) links.push({ icon: 'mdi-twitter', url: `https://x.com/${c.x}` });
  if (c.website) links.push({ icon: 'mdi-web', url: c.website });
  if (c.whatsapp) links.push({ icon: 'mdi-whatsapp', url: `https://wa.me/${c.whatsapp}` });
  if (c.website2) links.push({ icon: 'mdi-web', url: c.website2 });
  if (c.email) links.push({ icon: 'mdi-email-outline', url: `mailto:${c.email}` });
  return links;
}
