import React, { useState, useMemo, useEffect } from 'react';
import { ContactInquiry, InquiryService } from '../../../services/inquiryService';
import styles from './MetaAdsTab.module.css';

interface MetaAdsTabProps {
  inquiries: ContactInquiry[];
  onUpdateStatus: (id: string, status: ContactInquiry['status'], notes?: string) => void;
  onDeleteInquiry: (id: string) => void;
  onRefresh: () => void;
}

export const MetaAdsTab: React.FC<MetaAdsTabProps> = ({
  inquiries,
  onUpdateStatus,
  onDeleteInquiry,
  onRefresh,
}) => {
  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [webhookConfig, setWebhookConfig] = useState<{
    verifyToken: string;
    webhookEndpoint: string;
    verifyTokenConfigured: boolean;
    appSecretConfigured: boolean;
    pageAccessTokenConfigured: boolean;
  } | null>(null);

  // Auto-refresh interval every 12s for real-time sync
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh();
      setLastRefreshed(new Date());
    }, 12000);

    // Fetch webhook status
    InquiryService.getMetaWebhookStatus().then((cfg) => {
      setWebhookConfig(cfg);
    });

    return () => clearInterval(interval);
  }, [onRefresh]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`Copied ${label} to clipboard`);
    }
  };

  // Filter inquiries to only Meta leads
  const metaLeads = useMemo(() => {
    return inquiries.filter((inq) => {
      const isMetaSource = inq.source === 'Meta Lead Ad' || inq.source === 'Meta Ads';
      const hasMetaId = Boolean(inq.metaLeadId);
      const isMetaAttribution =
        inq.attribution?.source === 'Meta Ads' ||
        inq.attribution?.utm_source?.toLowerCase() === 'facebook' ||
        inq.attribution?.utm_source?.toLowerCase() === 'instagram' ||
        inq.attribution?.utm_source?.toLowerCase() === 'meta' ||
        Boolean(inq.attribution?.fbclid);

      return isMetaSource || hasMetaId || isMetaAttribution;
    });
  }, [inquiries]);

  // Unique courses for filter
  const uniqueCourses = useMemo(() => {
    const set = new Set<string>();
    metaLeads.forEach((l) => {
      if (l.courseInterest) set.add(l.courseInterest);
    });
    return Array.from(set);
  }, [metaLeads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return metaLeads.filter((lead) => {
      if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;
      if (courseFilter !== 'ALL' && lead.courseInterest !== courseFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (lead.name || '').toLowerCase().includes(q);
        const matchesEmail = (lead.email || '').toLowerCase().includes(q);
        const matchesPhone = (lead.phone || '').toLowerCase().includes(q);
        const matchesCourse = (lead.courseInterest || '').toLowerCase().includes(q);
        const matchesCampaign = (lead.attribution?.utm_campaign || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesCourse && !matchesCampaign) {
          return false;
        }
      }
      return true;
    });
  }, [metaLeads, statusFilter, courseFilter, searchTerm]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = metaLeads.length;
    const newCount = metaLeads.filter((l) => l.status === 'NEW').length;
    const contacted = metaLeads.filter((l) => l.status === 'CONTACTED').length;
    const enrolled = metaLeads.filter((l) => l.status === 'ENROLLED').length;
    const convRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;
    return { total, newCount, contacted, enrolled, convRate };
  }, [metaLeads]);

  // Clean phone number for WhatsApp URL
  const formatWhatsappLink = (phone: string, name: string, course: string) => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    const greeting = encodeURIComponent(
      `Hello ${name || 'there'}, thank you for inquiring about ${course || 'our music courses'} at Soundabode! How can we assist you with admissions?`
    );
    return `https://wa.me/${cleaned}?text=${greeting}`;
  };

  // Format relative time
  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Simulate a test lead
  const handleSimulateLead = async () => {
    setIsSimulating(true);
    try {
      const sampleNames = ['Rohan Kapoor', 'Ananya Deshmukh', 'Aditya Verma', 'Meera Nair', 'Kabir Sen'];
      const sampleCourses = [
        'Music Production & Sound Engineering',
        'Electronic Music Production (Ableton Live)',
        'Audio Post-Production & Mixing',
        'DJing & Live Electronic Performance',
      ];

      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomCourse = sampleCourses[Math.floor(Math.random() * sampleCourses.length)];
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      await InquiryService.simulateMetaLead({
        name: randomName,
        email: `${randomName.toLowerCase().replace(/\s+/g, '.')}${randomNum}@example.com`,
        phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
        courseInterest: randomCourse,
        campaignName: 'Instagram Reels - Music Production 2024',
        formName: 'Instant Admission Inquiry Form',
      });

      onRefresh();
      setLastRefreshed(new Date());
      showToast('Simulated Meta Lead Ad generated successfully!');
    } catch (err: any) {
      showToast(`Simulation error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://soundabode.com';
  const fullWebhookUrl = `${currentOrigin}/api/webhooks/meta-leads`;
  const verifyTokenString = webhookConfig?.verifyToken || 'soundabode_leads_2024';

  return (
    <div className={styles.metaContainer}>
      {/* ─── Hero Header ─── */}
      <div className={styles.heroCard}>
        <div className={styles.heroHeaderRow}>
          <div className={styles.titleArea}>
            <div className={styles.metaBrandIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </div>
            <div>
              <h1 className={styles.metaTitle}>
                Meta Ads Pipeline
                <span className={styles.liveSyncBadge}>
                  <span className={styles.pulseDot} />
                  Live Sync
                </span>
              </h1>
              <p className={styles.metaSubtitle}>
                Real-time lead capture from Facebook &amp; Instagram Lead Ad forms with automated Conversions API (CAPI) feedback.
              </p>
            </div>
          </div>

          <div className={styles.heroActions}>
            <button
              id="meta-ads-simulate-lead-btn"
              onClick={handleSimulateLead}
              disabled={isSimulating}
              className={styles.btnPrimary}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {isSimulating ? 'Generating...' : 'Simulate Test Lead'}
            </button>

            <button
              id="meta-ads-refresh-btn"
              onClick={async () => {
                setIsSyncing(true);
                try {
                  const result = await InquiryService.syncMetaLeads();
                  onRefresh();
                  setLastRefreshed(new Date());
                  if (result.cleaned > 0 || result.synced > 0) {
                    showToast(`Sync complete: ${result.synced} leads updated, ${result.cleaned} test entries removed`);
                  } else if (result.failed > 0) {
                    showToast(`Sync complete: ${result.failed} leads could not be fetched from Meta`);
                  } else {
                    showToast('All leads are up to date');
                  }
                } catch {
                  onRefresh();
                  setLastRefreshed(new Date());
                  showToast('Synced with latest leads');
                } finally {
                  setIsSyncing(false);
                }
              }}
              className={styles.btnSecondary}
              disabled={isSyncing}
              title={`Last synced: ${lastRefreshed.toLocaleTimeString()}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <button
              id="meta-ads-guide-btn"
              onClick={() => setIsGuideOpen(true)}
              className={styles.btnSecondary}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Setup Guide
            </button>
          </div>
        </div>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Total Meta Leads</span>
            <div className={styles.statIconWrapper}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statSubtext}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
            From native Facebook &amp; Instagram forms
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>New / Uncontacted</span>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 14" />
              </svg>
            </div>
          </div>
          <div className={styles.statValue} style={{ color: '#10b981' }}>{stats.newCount}</div>
          <div className={styles.statSubtext}>Requires immediate outreach</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Contacted</span>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(0, 129, 251, 0.1)', color: '#0081fb' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
          </div>
          <div className={styles.statValue}>{stats.contacted}</div>
          <div className={styles.statSubtext}>Counseling in progress</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Enrolled &amp; Conversion</span>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className={styles.statValue} style={{ color: '#a855f7' }}>
            {stats.enrolled}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
              ({stats.convRate}%)
            </span>
          </div>
          <div className={styles.statSubtext}>CAPI feedback loops completed</div>
        </div>
      </div>

      {/* ─── Filter & Toolbar ─── */}
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="meta-ads-search-input"
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.statusPills}>
            {(['ALL', 'NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`${styles.statusPillBtn} ${statusFilter === st ? styles.statusPillBtnActive : ''}`}
              >
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {uniqueCourses.length > 0 && (
            <select
              className={styles.courseSelect}
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="ALL">All Courses</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.viewToggleGroup}>
          <button
            onClick={() => setViewMode('cards')}
            className={`${styles.viewToggleBtn} ${viewMode === 'cards' ? styles.viewToggleBtnActive : ''}`}
            title="Card View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleBtnActive : ''}`}
            title="Table View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Table
          </button>
        </div>
      </div>

      {/* ─── Leads View: Cards or Table ─── */}
      {filteredLeads.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>No Meta Ad Leads Found</h3>
          <p className={styles.emptyDesc}>
            {searchTerm || statusFilter !== 'ALL' || courseFilter !== 'ALL'
              ? 'No leads matched your filter criteria. Try resetting filters or search term.'
              : 'Incoming leads submitted on your Facebook and Instagram ads will appear here automatically in real time.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleSimulateLead} className={styles.btnPrimary}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Simulate Test Lead
            </button>
            <button onClick={() => setIsGuideOpen(true)} className={styles.btnSecondary}>
              View Setup Instructions
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className={styles.leadsGrid}>
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className={`${styles.leadCard} ${lead.status === 'NEW' ? styles.leadCardNew : ''}`}
            >
              <div className={styles.leadCardHeader}>
                <div className={styles.leadNameCol}>
                  <h4 className={styles.leadName}>{lead.name || 'Meta Prospect'}</h4>
                  <span className={styles.leadTime}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatRelativeTime(lead.submittedAt)}
                  </span>
                </div>

                <select
                  className={styles.statusDropdown}
                  value={lead.status}
                  onChange={(e) => onUpdateStatus(lead.id, e.target.value as ContactInquiry['status'])}
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="ENROLLED">Enrolled</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              {/* Interested Course Badge */}
              <div className={styles.courseBadge}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                {lead.courseInterest || 'Music Production'}
              </div>

              {/* Contact Information & Action Buttons */}
              <div className={styles.contactInfoBox}>
                {/* Phone row with Call & WhatsApp */}
                <div className={styles.contactRow}>
                  <div className={styles.contactMain} title={lead.phone || 'No phone'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>{lead.phone || 'No phone provided'}</span>
                  </div>
                  {lead.phone && (
                    <div className={styles.contactActions}>
                      <a
                        href={`tel:${lead.phone}`}
                        className={styles.miniActionBtn}
                        title="Call Prospect"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </a>
                      <a
                        href={formatWhatsappLink(lead.phone, lead.name, lead.courseInterest)}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.miniActionBtn} ${styles.whatsappBtn}`}
                        title="Open WhatsApp Chat"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => copyToClipboard(lead.phone, 'phone')}
                        className={styles.miniActionBtn}
                        title="Copy Phone"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Email row */}
                <div className={styles.contactRow}>
                  <div className={styles.contactMain} title={lead.email || 'No email'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span>{lead.email || 'No email provided'}</span>
                  </div>
                  {lead.email && (
                    <div className={styles.contactActions}>
                      <a
                        href={`mailto:${lead.email}?subject=Soundabode Admissions Inquiry`}
                        className={styles.miniActionBtn}
                        title="Send Email"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      </a>
                      <button
                        onClick={() => copyToClipboard(lead.email, 'email')}
                        className={styles.miniActionBtn}
                        title="Copy Email"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Attribution & Campaign Footer */}
              <div className={styles.metaMetaRow}>
                <span>
                  Source: <strong>{lead.attribution?.utm_source || 'Facebook/Instagram'}</strong>
                </span>
                {lead.metaLeadId && (
                  <span title={`Meta Lead ID: ${lead.metaLeadId}`}>
                    ID: {lead.metaLeadId.slice(-6)}
                  </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                  <button
                    onClick={() => onDeleteInquiry(lead.id)}
                    className={styles.miniActionBtn}
                    style={{ color: '#ef4444' }}
                    title="Delete Lead"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className={styles.tableContainer}>
          <table className={styles.metaTable}>
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Interested Course</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.name}</strong>
                    {lead.status === 'NEW' && (
                      <span className={`${styles.liveSyncBadge} ${styles.badgeNew}`} style={{ marginLeft: '0.5rem', padding: '0.1rem 0.4rem' }}>
                        NEW
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={styles.courseBadge}>{lead.courseInterest}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{lead.phone || '—'}</span>
                      {lead.phone && (
                        <a
                          href={formatWhatsappLink(lead.phone, lead.name, lead.courseInterest)}
                          target="_blank"
                          rel="noreferrer"
                          className={`${styles.miniActionBtn} ${styles.whatsappBtn}`}
                          title="WhatsApp Chat"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td>{lead.email || '—'}</td>
                  <td>
                    <select
                      className={styles.statusDropdown}
                      value={lead.status}
                      onChange={(e) => onUpdateStatus(lead.id, e.target.value as ContactInquiry['status'])}
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="ENROLLED">Enrolled</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </td>
                  <td>{formatRelativeTime(lead.submittedAt)}</td>
                  <td>
                    <button
                      onClick={() => onDeleteInquiry(lead.id)}
                      className={styles.miniActionBtn}
                      style={{ color: '#ef4444' }}
                      title="Delete Lead"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Webhook Setup Guide Modal ─── */}
      {isGuideOpen && (
        <div className={styles.guideModalOverlay} onClick={() => setIsGuideOpen(false)}>
          <div className={styles.guideModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.guideHeader}>
              <h3 className={styles.guideTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Meta Lead Ads Webhook Setup
              </h3>
              <button onClick={() => setIsGuideOpen(false)} className={styles.closeBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Credentials Card */}
            <div className={styles.configCard}>
              <div className={styles.configRow}>
                <span className={styles.configLabel}>Callback URL (Webhook Endpoint)</span>
                <div className={styles.configValueBox}>
                  <span>{fullWebhookUrl}</span>
                  <button
                    onClick={() => copyToClipboard(fullWebhookUrl, 'Callback URL')}
                    className={styles.copyInlineBtn}
                    title="Copy URL"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className={styles.configRow}>
                <span className={styles.configLabel}>Verify Token</span>
                <div className={styles.configValueBox}>
                  <span>{verifyTokenString}</span>
                  <button
                    onClick={() => copyToClipboard(verifyTokenString, 'Verify Token')}
                    className={styles.copyInlineBtn}
                    title="Copy Token"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Setup Instructions */}
            <h4 style={{ margin: '0.5rem 0 0 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Meta App Dashboard Connection Steps:
            </h4>

            <ol className={styles.stepList}>
              <li className={styles.stepItem}>
                Open <strong>Meta for Developers</strong> &rarr; select your app (e.g. <em>Soundabode CRM</em>).
              </li>
              <li className={styles.stepItem}>
                Navigate to <strong>Webhooks</strong> in the left sidebar &rarr; select <strong>Page</strong> from the dropdown.
              </li>
              <li className={styles.stepItem}>
                Click <strong>Subscribe to this object</strong> &rarr; enter the <strong>Callback URL</strong> and <strong>Verify Token</strong> above &rarr; click <strong>Verify and save</strong>.
              </li>
              <li className={styles.stepItem}>
                In the Webhook fields table, locate <strong>leadgen</strong> and click <strong>Subscribe</strong>.
              </li>
              <li className={styles.stepItem}>
                Link your Facebook Page: Go to your <strong>Facebook Page &rarr; Settings &rarr; Linked Apps / Subscribed Apps</strong> and connect the app so it receives your lead ad form submissions.
              </li>
            </ol>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setIsGuideOpen(false);
                  handleSimulateLead();
                }}
                className={styles.btnPrimary}
              >
                Test With Simulated Lead
              </button>
              <button onClick={() => setIsGuideOpen(false)} className={styles.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toastSuccess}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
};
