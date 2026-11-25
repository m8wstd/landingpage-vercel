import { initialProjects } from '../data/projectsData';
import { defaultSiteConfig } from '../data/siteConfigData';

const PROJECTS_STORAGE_KEY = 'm8w_portfolio_projects_data_v1';
const SITE_CONFIG_STORAGE_KEY = 'm8w_portfolio_site_config_v1';
const AUTH_KEY = 'm8w_admin_session_token';
const AUTH_PASS_KEY = 'm8w_admin_session_password';

// ─── AUTENTICAÇÃO ────────────────────────────────────────────────────────────

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'valid_admin_session_active';
}

export function setAuthenticated(valid, password = null) {
  if (valid) {
    sessionStorage.setItem(AUTH_KEY, 'valid_admin_session_active');
    if (password) sessionStorage.setItem(AUTH_PASS_KEY, password);
  } else {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_PASS_KEY);
  }
}

function getSessionPassword() {
  return sessionStorage.getItem(AUTH_PASS_KEY);
}

/** Verifica a senha contra a API do servidor (async). */
export async function verifyAdminPassword(input) {
  try {
    const res = await fetch('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', password: input }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    // Fallback para dev sem vercel dev: compara com env ou padrão hardcoded
    return false;
  }
}

/** Troca a senha via API do servidor (async). */
export async function setAdminPassword(newPassword) {
  const currentPassword = getSessionPassword();
  const res = await fetch('/api/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'change', password: currentPassword, newPassword }),
  });
  const data = await res.json();
  if (data.ok) {
    // Atualiza a senha na sessão local para que próximas saves continuem funcionando
    sessionStorage.setItem(AUTH_PASS_KEY, newPassword.trim());
  }
  return data;
}

// ─── INICIALIZAÇÃO DO BLOB (chamada no startup do app) ───────────────────────

/**
 * Busca os dados mais recentes do Vercel Blob e popula o localStorage.
 * Se a API não estiver disponível (dev sem vercel dev), ignora silenciosamente.
 */
export async function initializeFromBlob() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) return;
    const data = await res.json();

    if (data.projects && Array.isArray(data.projects)) {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(data.projects));
    }
    if (data.siteConfig && typeof data.siteConfig === 'object') {
      localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(data.siteConfig));
    }

    window.dispatchEvent(new Event('portfolio_data_updated'));
    window.dispatchEvent(new Event('portfolio_projects_updated'));
  } catch {
    // Dev mode sem vercel dev — sem problema, usa localStorage/defaults
  }
}

// ─── GESTÃO DE PROJETOS ──────────────────────────────────────────────────────

export function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return initialProjects;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.error('Error loading projects:', err);
  }
  return initialProjects;
}

export async function saveProjects(projects) {
  try {
    // Salva localmente primeiro (UI imediata)
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    window.dispatchEvent(new Event('portfolio_data_updated'));
    window.dispatchEvent(new Event('portfolio_projects_updated'));

    // Persiste no Blob (visível para todos os visitantes)
    const password = getSessionPassword();
    if (password) {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ projects }),
      });
    }

    return true;
  } catch (err) {
    console.error('Error saving projects:', err);
    return false;
  }
}

// ─── GESTÃO DE CONTEÚDO DO SITE (Sobre, Experiência, Contato) ────────────────

export function loadSiteConfig() {
  try {
    const raw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
    if (!raw) return defaultSiteConfig;
    const parsed = JSON.parse(raw);

    // Migração transparente caso haja dados na estrutura legada
    const mergedAbout = {
      ...defaultSiteConfig.about,
      ...(parsed.about || {}),
      pt: {
        subtitle: parsed.about?.pt?.subtitle || parsed.about?.subtitlePt || defaultSiteConfig.about.pt.subtitle,
        desc: parsed.about?.pt?.desc || parsed.about?.descPt || defaultSiteConfig.about.pt.desc,
      },
      en: {
        subtitle: parsed.about?.en?.subtitle || parsed.about?.subtitleEn || defaultSiteConfig.about.en.subtitle,
        desc: parsed.about?.en?.desc || parsed.about?.descEn || defaultSiteConfig.about.en.desc,
      },
      education: {
        ...defaultSiteConfig.about.education,
        ...(parsed.about?.education || {}),
        pt: {
          course: parsed.about?.education?.pt?.course || parsed.about?.education?.coursePt || defaultSiteConfig.about.education.pt.course,
          period: parsed.about?.education?.pt?.period || parsed.about?.education?.period || defaultSiteConfig.about.education.pt.period,
          status: parsed.about?.education?.pt?.status || parsed.about?.education?.statusPt || defaultSiteConfig.about.education.pt.status,
          details: parsed.about?.education?.pt?.details || parsed.about?.education?.detailsPt || defaultSiteConfig.about.education.pt.details,
        },
        en: {
          course: parsed.about?.education?.en?.course || parsed.about?.education?.courseEn || defaultSiteConfig.about.education.en.course,
          period: parsed.about?.education?.en?.period || parsed.about?.education?.periodEn || parsed.about?.education?.period || defaultSiteConfig.about.education.en.period,
          status: parsed.about?.education?.en?.status || parsed.about?.education?.statusEn || defaultSiteConfig.about.education.en.status,
          details: parsed.about?.education?.en?.details || parsed.about?.education?.detailsEn || defaultSiteConfig.about.education.en.details,
        }
      }
    };

    const mergedExperience = Array.isArray(parsed.experience)
      ? parsed.experience.map(e => ({
          id: e.id,
          image: e.image || "",
          tags: e.tags || [],
          pt: {
            period: e.pt?.period || e.periodPt || "",
            title: e.pt?.title || e.titlePt || "",
            company: e.pt?.company || e.companyPt || "",
            desc: e.pt?.desc || e.descPt || ""
          },
          en: {
            period: e.en?.period || e.periodEn || e.pt?.period || e.periodPt || "",
            title: e.en?.title || e.titleEn || e.pt?.title || e.titlePt || "",
            company: e.en?.company || e.companyEn || e.pt?.company || e.companyPt || "",
            desc: e.en?.desc || e.descEn || e.pt?.desc || e.descPt || ""
          }
        }))
      : defaultSiteConfig.experience;

    const mergedContact = {
      ...defaultSiteConfig.contact,
      ...(parsed.contact || {}),
      pt: {
        title: parsed.contact?.pt?.title || parsed.contact?.titlePt || defaultSiteConfig.contact.pt.title,
        desc: parsed.contact?.pt?.desc || parsed.contact?.descPt || defaultSiteConfig.contact.pt.desc,
        whatsappMsg: parsed.contact?.pt?.whatsappMsg || parsed.contact?.whatsappDefaultMsgPt || defaultSiteConfig.contact.pt.whatsappMsg
      },
      en: {
        title: parsed.contact?.en?.title || parsed.contact?.titleEn || defaultSiteConfig.contact.en.title,
        desc: parsed.contact?.en?.desc || parsed.contact?.descEn || defaultSiteConfig.contact.en.desc,
        whatsappMsg: parsed.contact?.en?.whatsappMsg || parsed.contact?.whatsappDefaultMsgEn || defaultSiteConfig.contact.en.whatsappMsg
      }
    };

    const mergedProjectsSection = {
      ...defaultSiteConfig.projectsSection,
      ...(parsed.projectsSection || {}),
      pt: {
        title: parsed.projectsSection?.pt?.title || defaultSiteConfig.projectsSection.pt.title,
        desc: parsed.projectsSection?.pt?.desc || defaultSiteConfig.projectsSection.pt.desc
      },
      en: {
        title: parsed.projectsSection?.en?.title || defaultSiteConfig.projectsSection.en.title,
        desc: parsed.projectsSection?.en?.desc || defaultSiteConfig.projectsSection.en.desc
      }
    };

    return {
      about: mergedAbout,
      experience: mergedExperience,
      contact: mergedContact,
      projectsSection: mergedProjectsSection,
    };
  } catch (err) {
    console.error('Error loading site config:', err);
  }
  return defaultSiteConfig;
}

export async function saveSiteConfig(newConfig) {
  try {
    // Salva localmente primeiro (UI imediata)
    localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    window.dispatchEvent(new Event('portfolio_data_updated'));

    // Persiste no Blob (visível para todos os visitantes)
    const password = getSessionPassword();
    if (password) {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ siteConfig: newConfig }),
      });
    }

    return true;
  } catch (err) {
    console.error('Error saving site config:', err);
    return false;
  }
}

// ─── RESET ───────────────────────────────────────────────────────────────────

export function resetAllToDefaults() {
  localStorage.removeItem(PROJECTS_STORAGE_KEY);
  localStorage.removeItem(SITE_CONFIG_STORAGE_KEY);
  window.dispatchEvent(new Event('portfolio_data_updated'));
  window.dispatchEvent(new Event('portfolio_projects_updated'));
}
