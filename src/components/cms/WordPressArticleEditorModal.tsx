import React, { useState, useEffect, useRef } from 'react';
import type { BlogPost } from '../../types/blog';
import { safeImageUrl, sanitizeHtml } from '../../utils/security';
import styles from './WordPressArticleEditorModal.module.css';

export interface WordPressArticleEditorModalProps {
  isOpen?: boolean;
  isInline?: boolean;
  editingPostId: string | null;
  initialData: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: BlogPost['category'];
    coverImage: string;
    readTimeMinutes: number;
    authorName: string;
    authorRole: string;
    authorAvatarUrl: string;
    isFeatured: boolean;
    tags: string;
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    twitterCard: 'summary' | 'summary_large_image';
    noIndex: boolean;
    schemaType: 'Article' | 'BlogPosting' | 'NewsArticle';
  };
  onClose: () => void;
  onSave: (formData: any) => void;
}

export const WordPressArticleEditorModal: React.FC<WordPressArticleEditorModalProps> = ({
  isOpen = true,
  isInline = false,
  editingPostId,
  initialData,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState(initialData);
  const [editorMode, setEditorMode] = useState<'visual' | 'code' | 'preview'>('visual');
  const [sidebarTab, setSidebarTab] = useState<'post' | 'seo'>('post');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dialog popups for links, images, tables
  const [activeDialog, setActiveDialog] = useState<'link' | 'image' | 'table' | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);

  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageCaption, setImageCaption] = useState('');

  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCustomBlocks, setShowCustomBlocks] = useState(false);

  // Reference to the contentEditable visual canvas
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // Sync initialData when modal opens
  useEffect(() => {
    setFormData(initialData);
    if (visualEditorRef.current && initialData.content) {
      visualEditorRef.current.innerHTML = initialData.content;
    }
  }, [initialData, isOpen]);

  // Keep contentEditable in sync when switching tabs
  useEffect(() => {
    if (editorMode === 'visual' && visualEditorRef.current) {
      visualEditorRef.current.innerHTML = formData.content;
    }
  }, [editorMode]);

  if (!isOpen) return null;

  // Save current selection for dialog insertions
  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && savedSelectionRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRangeRef.current);
    }
  };

  // Helper to execute commands in visual editor
  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (visualEditorRef.current) {
      visualEditorRef.current.focus();
    }
    document.execCommand(command, false, value);
    handleVisualContentChange();
  };

  const handleVisualContentChange = () => {
    if (visualEditorRef.current) {
      const html = visualEditorRef.current.innerHTML;
      setFormData((prev) => ({ ...prev, content: html }));
    }
  };

  // Format Blocks (p, h2, h3, h4, blockquote, pre)
  const handleBlockFormat = (tag: string) => {
    if (tag === 'p') {
      execCmd('formatBlock', '<p>');
    } else if (tag === 'h2') {
      execCmd('formatBlock', '<h2>');
    } else if (tag === 'h3') {
      execCmd('formatBlock', '<h3>');
    } else if (tag === 'h4') {
      execCmd('formatBlock', '<h4>');
    } else if (tag === 'blockquote') {
      execCmd('formatBlock', '<blockquote>');
    } else if (tag === 'pre') {
      execCmd('formatBlock', '<pre>');
    }
  };

  // Custom WordPress Blocks
  const insertCustomBlock = (type: 'takeaway' | 'tip' | 'alert') => {
    let blockHtml = '';
    if (type === 'takeaway') {
      blockHtml = `<div class="takeawayBox" style="background: rgba(99, 102, 241, 0.1); border-left: 4px solid #6366f1; padding: 1rem; border-radius: 6px; margin: 1.25rem 0;"><strong style="color: #a5b4fc; display: block; margin-bottom: 0.35rem;">KEY TAKEAWAY</strong><p style="margin: 0; color: #e0e7ff;">Highlight the central insight or action item for music producers here.</p></div><p></p>`;
    } else if (type === 'tip') {
      blockHtml = `<div class="tipBox" style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; border-radius: 6px; margin: 1.25rem 0;"><strong style="color: #6ee7b7; display: block; margin-bottom: 0.35rem;">PRO TIP</strong><p style="margin: 0; color: #d1fae5;">Share an actionable studio workflow tip, plugin shortcut, or mixing secret.</p></div><p></p>`;
    } else if (type === 'alert') {
      blockHtml = `<div class="alertBox" style="background: rgba(225, 29, 72, 0.1); border-left: 4px solid #e11d48; padding: 1rem; border-radius: 6px; margin: 1.25rem 0;"><strong style="color: #fda4af; display: block; margin-bottom: 0.35rem;">IMPORTANT NOTE</strong><p style="margin: 0; color: #ffe4e6;">Crucial detail or common pitfall to avoid during track mastering.</p></div><p></p>`;
    }

    if (editorMode === 'visual') {
      execCmd('insertHTML', blockHtml);
    } else {
      setFormData((prev) => ({ ...prev, content: prev.content + '\n\n' + blockHtml }));
    }
    setShowCustomBlocks(false);
  };

  // Link Dialog
  const openLinkDialog = () => {
    saveCurrentSelection();
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    setLinkText(selectedText);
    setLinkUrl('');
    setActiveDialog('link');
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl) return;
    restoreCurrentSelection();

    const targetAttr = linkNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    const safeUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://') || linkUrl.startsWith('/')
      ? linkUrl
      : `https://${linkUrl}`;

    if (editorMode === 'visual') {
      if (linkText) {
        const linkHtml = `<a href="${safeUrl}"${targetAttr}>${linkText}</a>`;
        execCmd('insertHTML', linkHtml);
      } else {
        execCmd('createLink', safeUrl);
      }
    } else {
      const linkHtml = `<a href="${safeUrl}"${targetAttr}>${linkText || safeUrl}</a>`;
      setFormData((prev) => ({ ...prev, content: prev.content + linkHtml }));
    }

    setActiveDialog(null);
  };

  // Image Dialog
  const openImageDialog = () => {
    saveCurrentSelection();
    setImageUrl('');
    setImageAlt('');
    setImageCaption('');
    setActiveDialog('image');
  };

  const handleInsertImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) return;
    restoreCurrentSelection();

    const safeSrc = safeImageUrl(imageUrl);
    const captionHtml = imageCaption ? `<figcaption style="font-size: 0.8rem; color: #94a3b8; text-align: center; margin-top: 0.4rem;">${imageCaption}</figcaption>` : '';
    const imgHtml = `<figure style="margin: 1.5rem 0; text-align: center;"><img src="${safeSrc}" alt="${imageAlt || 'Article illustration'}" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" />${captionHtml}</figure><p></p>`;

    if (editorMode === 'visual') {
      execCmd('insertHTML', imgHtml);
    } else {
      setFormData((prev) => ({ ...prev, content: prev.content + '\n' + imgHtml }));
    }

    setActiveDialog(null);
  };

  // Table Dialog
  const openTableDialog = () => {
    saveCurrentSelection();
    setTableRows(3);
    setTableCols(3);
    setActiveDialog('table');
  };

  const handleInsertTable = (e: React.FormEvent) => {
    e.preventDefault();
    restoreCurrentSelection();

    let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 0.875rem;"><thead><tr>';
    for (let c = 1; c <= tableCols; c++) {
      tableHtml += `<th style="border: 1px solid rgba(255,255,255,0.15); padding: 8px 12px; background: rgba(255,255,255,0.06); color: #fff; text-align: left;">Header ${c}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    for (let r = 1; r <= tableRows; r++) {
      tableHtml += '<tr>';
      for (let c = 1; c <= tableCols; c++) {
        tableHtml += `<td style="border: 1px solid rgba(255,255,255,0.12); padding: 8px 12px; color: #cbd5e1;">Row ${r} Col ${c}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p></p>';

    if (editorMode === 'visual') {
      execCmd('insertHTML', tableHtml);
    } else {
      setFormData((prev) => ({ ...prev, content: prev.content + '\n' + tableHtml }));
    }

    setActiveDialog(null);
  };

  // Text Color Presets
  const applyTextColor = (color: string) => {
    execCmd('foreColor', color);
    setShowColorPicker(false);
  };

  // Compute Word & Character counts
  const rawText = (formData.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = rawText ? rawText.split(' ').length : 0;
  const charCount = rawText.length;
  const estimatedReadMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const syncReadTime = () => {
    setFormData((prev) => ({ ...prev, readTimeMinutes: estimatedReadMinutes }));
  };

  // SEO Score Analyzer
  const targetKeyword = (formData.focusKeyword || '').toLowerCase().trim();
  const hasKeywordInTitle = targetKeyword ? formData.title.toLowerCase().includes(targetKeyword) : false;
  const hasKeywordInDesc = targetKeyword ? formData.metaDescription.toLowerCase().includes(targetKeyword) : false;
  const hasKeywordInContent = targetKeyword ? rawText.toLowerCase().includes(targetKeyword) : false;
  const titleLengthOk = formData.metaTitle.length >= 40 && formData.metaTitle.length <= 60;
  const descLengthOk = formData.metaDescription.length >= 120 && formData.metaDescription.length <= 160;

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const editorContent = (
    <div className={`${isInline ? styles.inlineCard : styles.modalCard} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* ── TOP BAR / CMS NAVIGATION ── */}
        <div className={styles.editorTopBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.cmsBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              WordPress CMS
            </span>
            <h2 className={styles.modalTitle}>
              {editingPostId ? 'Edit Article & Publication' : 'Create New Article'}
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className={styles.modeSwitcher}>
            <button
              type="button"
              onClick={() => setEditorMode('visual')}
              className={`${styles.modeBtn} ${editorMode === 'visual' ? styles.activeMode : ''}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Visual
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('code')}
              className={`${styles.modeBtn} ${editorMode === 'code' ? styles.activeMode : ''}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Code (HTML)
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`${styles.modeBtn} ${editorMode === 'preview' ? styles.activeMode : ''}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Live Preview
            </button>
          </div>

          {/* Top Bar Actions */}
          <div className={styles.topBarRight}>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={styles.iconBtn}
              title={isFullscreen ? 'Exit Fullscreen' : 'Zen Fullscreen'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </>
                ) : (
                  <>
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </>
                )}
              </svg>
            </button>

            <button type="button" onClick={onClose} className={styles.btnCancel}>
              Cancel
            </button>

            <button type="button" onClick={handleSubmit} className={styles.btnPublish}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {editingPostId ? 'Update & Publish' : 'Publish Article'}
            </button>
          </div>
        </div>

        {/* ── WORKSPACE ── */}
        <div className={styles.editorWorkspace}>
          {/* LEFT MAIN EDITING COLUMN */}
          <div className={styles.mainContentColumn}>
            {/* Title & Excerpt Inputs */}
            <div className={styles.articleMetaInputs}>
              <div className={styles.titleInputWrap}>
                <input
                  type="text"
                  placeholder="Add Article Title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={styles.titleInput}
                  required
                />
              </div>

              <div className={styles.excerptInputWrap}>
                <label className={styles.excerptLabel}>Short Excerpt / Teaser</label>
                <textarea
                  rows={2}
                  placeholder="Write a brief excerpt summarizing the core theme of this article..."
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className={styles.excerptTextarea}
                  required
                />
              </div>
            </div>

            {/* WORDPRESS CMS RICH TOOLBAR (when in visual mode) */}
            {editorMode === 'visual' && (
              <div className={styles.toolbarContainer}>
                {/* History */}
                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={() => execCmd('undo')}
                    className={styles.toolBtn}
                    title="Undo (Ctrl+Z)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7v6h6" />
                      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('redo')}
                    className={styles.toolBtn}
                    title="Redo (Ctrl+Y)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 7v6h-6" />
                      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                    </svg>
                  </button>
                </div>

                {/* Headings & Blocks */}
                <div className={styles.toolbarGroup}>
                  <select
                    className={styles.toolSelect}
                    onChange={(e) => handleBlockFormat(e.target.value)}
                    defaultValue="p"
                  >
                    <option value="p">Paragraph</option>
                    <option value="h2">Heading 2 (H2)</option>
                    <option value="h3">Heading 3 (H3)</option>
                    <option value="h4">Heading 4 (H4)</option>
                    <option value="blockquote">Quote Block</option>
                    <option value="pre">Code Block</option>
                  </select>
                </div>

                <div className={styles.toolbarDivider} />

                {/* Inline Formatting */}
                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={() => execCmd('bold')}
                    className={styles.toolBtn}
                    title="Bold (Ctrl+B)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('italic')}
                    className={styles.toolBtn}
                    title="Italic (Ctrl+I)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="19" y1="4" x2="10" y2="4" />
                      <line x1="14" y1="20" x2="5" y2="20" />
                      <line x1="15" y1="4" x2="9" y2="20" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('underline')}
                    className={styles.toolBtn}
                    title="Underline (Ctrl+U)"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
                      <line x1="4" y1="21" x2="20" y2="21" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('strikeThrough')}
                    className={styles.toolBtn}
                    title="Strikethrough"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <path d="M16 6C16 6 14.5 4 12 4C9.5 4 8 5.5 8 7.5C8 11.5 16 11.5 16 15.5C16 18 14 20 11.5 20C9 20 7.5 18 7.5 18" />
                    </svg>
                  </button>

                  {/* Text Color Dropdown */}
                  <div className={styles.colorPickerWrap}>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className={styles.toolBtn}
                      title="Text Color"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" />
                        <path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" />
                      </svg>
                    </button>
                    {showColorPicker && (
                      <div className={styles.colorMenu}>
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#ffffff' }}
                          title="Default White"
                          onClick={() => applyTextColor('#ffffff')}
                        />
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#ef4444' }}
                          title="Ruby Red"
                          onClick={() => applyTextColor('#ef4444')}
                        />
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#f59e0b' }}
                          title="Amber Gold"
                          onClick={() => applyTextColor('#f59e0b')}
                        />
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#10b981' }}
                          title="Emerald Green"
                          onClick={() => applyTextColor('#10b981')}
                        />
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#0ea5e9' }}
                          title="Sky Blue"
                          onClick={() => applyTextColor('#0ea5e9')}
                        />
                        <div
                          className={styles.colorSwatch}
                          style={{ background: '#a855f7' }}
                          title="Purple"
                          onClick={() => applyTextColor('#a855f7')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.toolbarDivider} />

                {/* Alignment */}
                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={() => execCmd('justifyLeft')}
                    className={styles.toolBtn}
                    title="Align Left"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="17" y1="10" x2="3" y2="10" />
                      <line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" />
                      <line x1="17" y1="18" x2="3" y2="18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('justifyCenter')}
                    className={styles.toolBtn}
                    title="Align Center"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="10" x2="6" y2="10" />
                      <line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" />
                      <line x1="18" y1="18" x2="6" y2="18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => execCmd('justifyRight')}
                    className={styles.toolBtn}
                    title="Align Right"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="21" y1="10" x2="7" y2="10" />
                      <line x1="21" y1="6" x2="3" y2="6" />
                      <line x1="21" y1="14" x2="3" y2="14" />
                      <line x1="21" y1="18" x2="7" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className={styles.toolbarDivider} />

                {/* Lists & Quotes */}
                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={() => execCmd('insertUnorderedList')}
                    className={styles.toolBtn}
                    title="Bullet List"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('insertOrderedList')}
                    className={styles.toolBtn}
                    title="Numbered List"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="10" y1="6" x2="21" y2="6" />
                      <line x1="10" y1="12" x2="21" y2="12" />
                      <line x1="10" y1="18" x2="21" y2="18" />
                      <path d="M4 6h1v4" />
                      <path d="M4 10h2" />
                      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('insertHorizontalRule')}
                    className={styles.toolBtn}
                    title="Horizontal Divider"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                  </button>
                </div>

                <div className={styles.toolbarDivider} />

                {/* Media & Custom Inserts */}
                <div className={styles.toolbarGroup}>
                  <button
                    type="button"
                    onClick={openLinkDialog}
                    className={styles.toolBtn}
                    title="Insert Link"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => execCmd('unlink')}
                    className={styles.toolBtn}
                    title="Remove Link"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={openImageDialog}
                    className={styles.toolBtn}
                    title="Insert Image"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={openTableDialog}
                    className={styles.toolBtn}
                    title="Insert Table"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3h18v18H3z" />
                      <path d="M3 9h18" />
                      <path d="M3 15h18" />
                      <path d="M9 3v18" />
                      <path d="M15 3v18" />
                    </svg>
                  </button>

                  {/* Callout Custom Blocks */}
                  <div className={styles.colorPickerWrap}>
                    <button
                      type="button"
                      onClick={() => setShowCustomBlocks(!showCustomBlocks)}
                      className={styles.toolBtn}
                      style={{ width: 'auto', padding: '0 0.45rem', gap: '0.25rem', fontSize: '0.72rem' }}
                      title="Insert Callout Blocks"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Callouts
                    </button>
                    {showCustomBlocks && (
                      <div className={styles.customBlocksMenu}>
                        <button
                          type="button"
                          className={styles.customBlockItem}
                          onClick={() => insertCustomBlock('tip')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Pro Tip Callout
                        </button>
                        <button
                          type="button"
                          className={styles.customBlockItem}
                          onClick={() => insertCustomBlock('takeaway')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          Key Takeaway Box
                        </button>
                        <button
                          type="button"
                          className={styles.customBlockItem}
                          onClick={() => insertCustomBlock('alert')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Important Note Box
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.toolbarDivider} />

                {/* Clear formatting */}
                <button
                  type="button"
                  onClick={() => execCmd('removeFormat')}
                  className={styles.toolBtn}
                  title="Clear Formatting"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* CANVAS WRAPPER (Visual / Code / Preview) */}
            <div className={styles.editorCanvasWrapper}>
              {editorMode === 'visual' && (
                <div
                  ref={visualEditorRef}
                  contentEditable
                  onInput={handleVisualContentChange}
                  className={styles.visualEditor}
                  data-placeholder="Start writing your article here... Type paragraphs, use the toolbar for headings, quotes, tables, and images."
                />
              )}

              {editorMode === 'code' && (
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className={styles.codeEditorTextarea}
                  placeholder="<h2>Enter HTML source code here...</h2>"
                />
              )}

              {editorMode === 'preview' && (
                <div className={styles.livePreviewWrap}>
                  <span className={styles.previewCategory}>{formData.category}</span>
                  <h1 className={styles.previewTitle}>{formData.title || 'Untitled Article'}</h1>
                  <p className={styles.previewExcerpt}>{formData.excerpt || 'Article excerpt goes here...'}</p>
                  <div className={styles.previewMeta}>
                    <span>By {formData.authorName || 'Soundabode Team'}</span>
                    <span>•</span>
                    <span>{formData.readTimeMinutes} min read</span>
                  </div>

                  {formData.coverImage && (
                    <img
                      src={safeImageUrl(formData.coverImage)}
                      alt={formData.title}
                      className={styles.previewHeroImg}
                    />
                  )}

                  <div
                    className={styles.visualEditor}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.content) }}
                  />
                </div>
              )}
            </div>

            {/* STATS FOOTER BAR */}
            <div className={styles.statsFooterBar}>
              <div className={styles.statsLeft}>
                <span className={styles.statItem}>
                  Words: <strong className={styles.statValue}>{wordCount}</strong>
                </span>
                <span className={styles.statItem}>
                  Characters: <strong className={styles.statValue}>{charCount}</strong>
                </span>
                <span className={styles.statItem}>
                  Estimated Read Time: <strong className={styles.statValue}>{estimatedReadMinutes} min</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={syncReadTime}
                className={styles.syncReadTimeBtn}
                title="Update post read time setting based on word count"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Sync to Post ({estimatedReadMinutes}m)
              </button>
            </div>
          </div>

          {/* RIGHT SIDEBAR (WORDPRESS INSPECTOR) */}
          <div className={styles.sidebarColumn}>
            {/* Sidebar Tabs */}
            <div className={styles.sidebarTabs}>
              <button
                type="button"
                onClick={() => setSidebarTab('post')}
                className={`${styles.sidebarTabBtn} ${sidebarTab === 'post' ? styles.activeSidebarTab : ''}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Post Settings
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('seo')}
                className={`${styles.sidebarTabBtn} ${sidebarTab === 'seo' ? styles.activeSidebarTab : ''}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                SEO &amp; Meta
              </button>
            </div>

            {/* TAB 1: POST SETTINGS */}
            {sidebarTab === 'post' && (
              <div className={styles.sidebarContent}>
                {/* Category & Read Time */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Publishing Details</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as BlogPost['category'] })}
                        className={styles.selectControl}
                      >
                        <option value="PRODUCTION">PRODUCTION</option>
                        <option value="DJING">DJING</option>
                        <option value="GENERAL">GENERAL</option>
                        <option value="ACADEMY NEWS">ACADEMY NEWS</option>
                        <option value="GEAR & TECH">GEAR &amp; TECH</option>
                      </select>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Read Time (mins)</label>
                        <input
                          type="number"
                          value={formData.readTimeMinutes}
                          onChange={(e) => setFormData({ ...formData, readTimeMinutes: Number(e.target.value) })}
                          className={styles.inputControl}
                        />
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Featured</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', color: '#cbd5e1' }}>
                          <input
                            type="checkbox"
                            checked={formData.isFeatured}
                            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                            style={{ accentColor: '#e11d48' }}
                          />
                          Hero Pin
                        </label>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Custom Slug (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. mastering-workflow-guide"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className={styles.inputControl}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Tags (comma separated)</label>
                      <input
                        type="text"
                        placeholder="Music Production, Ableton, Mixing"
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className={styles.inputControl}
                      />
                      {formData.tags && (
                        <div className={styles.tagChipsWrap}>
                          {formData.tags.split(',').map((t, idx) => {
                            const trimmed = t.trim();
                            if (!trimmed) return null;
                            return (
                              <span key={idx} className={styles.tagChip}>
                                #{trimmed}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Featured Cover Image */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Featured Cover Image</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Cover Image URL</label>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        value={formData.coverImage}
                        onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                        className={styles.inputControl}
                        required
                      />
                    </div>

                    <div className={styles.imagePreviewBox}>
                      {formData.coverImage ? (
                        <img
                          src={safeImageUrl(formData.coverImage)}
                          alt="Cover preview"
                          className={styles.imagePreviewImg}
                        />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span>No cover image set</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Author Profile & Credentials */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Author Profile</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Author Name</label>
                      <input
                        type="text"
                        value={formData.authorName}
                        onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                        className={styles.inputControl}
                        placeholder="e.g. Soundabode Team"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Role / Title</label>
                      <input
                        type="text"
                        value={formData.authorRole}
                        onChange={(e) => setFormData({ ...formData, authorRole: e.target.value })}
                        className={styles.inputControl}
                        placeholder="e.g. Senior Ableton Mentor"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Avatar URL</label>
                      <input
                        type="text"
                        value={formData.authorAvatarUrl}
                        onChange={(e) => setFormData({ ...formData, authorAvatarUrl: e.target.value })}
                        className={styles.inputControl}
                        placeholder="https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_1400.JPG"
                      />
                      <div className={styles.avatarPreviewRow}>
                        <img
                          src={safeImageUrl(formData.authorAvatarUrl) || 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_1400.JPG'}
                          alt={formData.authorName || 'Abhinav'}
                          className={styles.avatarPreviewThumb}
                        />
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {formData.authorAvatarUrl ? 'Avatar preview' : 'Default (Abhinav) preview'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SEO & META (YOAST / RANKMATH STYLE) */}
            {sidebarTab === 'seo' && (
              <div className={styles.sidebarContent}>
                {/* Google SERP Snippet Preview */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Google Search Snippet Preview</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.serpPreviewBox}>
                      <div className={styles.serpUrl}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        <span>soundabode.com › blog › {formData.slug || 'article-slug'}</span>
                      </div>
                      <div className={styles.serpTitle}>
                        {formData.metaTitle || formData.title || 'Soundabode Article Title'}
                      </div>
                      <div className={styles.serpDesc}>
                        {formData.metaDescription || formData.excerpt || 'Article summary snippet as displayed on Google search engine result pages...'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Focus Keyword & Analysis */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Focus Keyword Optimization</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Focus Keyword</label>
                      <input
                        type="text"
                        placeholder="e.g. music production Pune"
                        value={formData.focusKeyword}
                        onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                        className={styles.inputControl}
                      />
                    </div>

                    {formData.focusKeyword && (
                      <div className={styles.seoChecklist}>
                        <div className={`${styles.seoCheckItem} ${hasKeywordInTitle ? styles.pass : styles.warn}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {hasKeywordInTitle ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
                          </svg>
                          <span>Keyword in Title ({hasKeywordInTitle ? 'Found' : 'Missing'})</span>
                        </div>

                        <div className={`${styles.seoCheckItem} ${hasKeywordInDesc ? styles.pass : styles.warn}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {hasKeywordInDesc ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
                          </svg>
                          <span>Keyword in Meta Description ({hasKeywordInDesc ? 'Found' : 'Missing'})</span>
                        </div>

                        <div className={`${styles.seoCheckItem} ${hasKeywordInContent ? styles.pass : styles.warn}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {hasKeywordInContent ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
                          </svg>
                          <span>Keyword in Article Body ({hasKeywordInContent ? 'Found' : 'Missing'})</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta Title & Meta Description */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Meta Tags</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>
                        <span>Meta Title</span>
                        <span style={{ color: titleLengthOk ? '#4ade80' : '#fbbf24', fontSize: '0.68rem' }}>
                          {formData.metaTitle.length}/60 chars
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder={formData.title || 'Defaults to article title'}
                        value={formData.metaTitle}
                        onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                        className={styles.inputControl}
                        maxLength={75}
                      />
                      <div className={styles.seoProgressTrack}>
                        <div
                          className={styles.seoProgressBar}
                          style={{
                            width: `${Math.min(100, (formData.metaTitle.length / 60) * 100)}%`,
                            backgroundColor: titleLengthOk ? '#4ade80' : formData.metaTitle.length > 60 ? '#f87171' : '#fbbf24',
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.fieldGroup} style={{ marginTop: '0.5rem' }}>
                      <label className={styles.fieldLabel}>
                        <span>Meta Description</span>
                        <span style={{ color: descLengthOk ? '#4ade80' : '#fbbf24', fontSize: '0.68rem' }}>
                          {formData.metaDescription.length}/160 chars
                        </span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Write a compelling snippet for search results..."
                        value={formData.metaDescription}
                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                        className={styles.inputControl}
                        style={{ minHeight: '55px' }}
                        maxLength={180}
                      />
                      <div className={styles.seoProgressTrack}>
                        <div
                          className={styles.seoProgressBar}
                          style={{
                            width: `${Math.min(100, (formData.metaDescription.length / 160) * 100)}%`,
                            backgroundColor: descLengthOk ? '#4ade80' : formData.metaDescription.length > 160 ? '#f87171' : '#fbbf24',
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.fieldGroup} style={{ marginTop: '0.5rem' }}>
                      <label className={styles.fieldLabel}>JSON-LD Schema Type</label>
                      <select
                        value={formData.schemaType}
                        onChange={(e) => setFormData({ ...formData, schemaType: e.target.value as any })}
                        className={styles.selectControl}
                      >
                        <option value="BlogPosting">BlogPosting (recommended)</option>
                        <option value="Article">Article</option>
                        <option value="NewsArticle">NewsArticle</option>
                      </select>
                    </div>

                    <div className={styles.fieldGroup} style={{ marginTop: '0.5rem' }}>
                      <label className={styles.fieldLabel}>Canonical URL</label>
                      <input
                        type="url"
                        placeholder="https://soundabode.com/blog/article-slug"
                        value={formData.canonicalUrl}
                        onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                        className={styles.inputControl}
                      />
                    </div>

                    {/* No Index Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="modalNoIndexToggle"
                        checked={formData.noIndex}
                        onChange={(e) => setFormData({ ...formData, noIndex: e.target.checked })}
                        style={{ accentColor: '#818cf8', cursor: 'pointer' }}
                      />
                      <label htmlFor="modalNoIndexToggle" style={{ fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer' }}>
                        No-Index (Hide page from search engines)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Social Open Graph */}
                <div className={styles.panelSection}>
                  <div className={styles.panelHeader}>
                    <span>Open Graph &amp; Social Sharing</span>
                  </div>
                  <div className={styles.panelBody}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>OG Title</label>
                      <input
                        type="text"
                        placeholder={formData.metaTitle || formData.title}
                        value={formData.ogTitle}
                        onChange={(e) => setFormData({ ...formData, ogTitle: e.target.value })}
                        className={styles.inputControl}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>OG Description</label>
                      <textarea
                        rows={2}
                        placeholder={formData.metaDescription || formData.excerpt}
                        value={formData.ogDescription}
                        onChange={(e) => setFormData({ ...formData, ogDescription: e.target.value })}
                        className={styles.inputControl}
                        style={{ minHeight: '48px' }}
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>OG Image URL</label>
                      <input
                        type="text"
                        placeholder={formData.coverImage}
                        value={formData.ogImage}
                        onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                        className={styles.inputControl}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── DIALOG OVERLAYS FOR LINK / IMAGE / TABLE ── */}
        {activeDialog === 'link' && (
          <div className={styles.dialogOverlay} onClick={() => setActiveDialog(null)}>
            <div className={styles.dialogCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dialogHeader}>
                <span className={styles.dialogTitle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Insert / Edit Link
                </span>
                <button type="button" onClick={() => setActiveDialog(null)} className={styles.iconBtn}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleInsertLink}>
                <div className={styles.dialogBody}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Destination URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com or /courses"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className={styles.inputControl}
                      required
                      autoFocus
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Display Text</label>
                    <input
                      type="text"
                      placeholder="Link text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      className={styles.inputControl}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={linkNewTab}
                      onChange={(e) => setLinkNewTab(e.target.checked)}
                      style={{ accentColor: '#e11d48' }}
                    />
                    Open link in a new tab (target="_blank")
                  </label>
                </div>
                <div className={styles.dialogFooter}>
                  <button type="button" onClick={() => setActiveDialog(null)} className={styles.btnCancel}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPublish}>
                    Insert Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeDialog === 'image' && (
          <div className={styles.dialogOverlay} onClick={() => setActiveDialog(null)}>
            <div className={styles.dialogCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dialogHeader}>
                <span className={styles.dialogTitle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Insert Image into Content
                </span>
                <button type="button" onClick={() => setActiveDialog(null)} className={styles.iconBtn}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleInsertImage}>
                <div className={styles.dialogBody}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Image URL</label>
                    <input
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className={styles.inputControl}
                      required
                      autoFocus
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Alt Text (for accessibility &amp; SEO)</label>
                    <input
                      type="text"
                      placeholder="e.g. Ableton Live 12 arrangement view"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      className={styles.inputControl}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Caption (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Fig 1. Routing drum busses in studio"
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      className={styles.inputControl}
                    />
                  </div>
                </div>
                <div className={styles.dialogFooter}>
                  <button type="button" onClick={() => setActiveDialog(null)} className={styles.btnCancel}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPublish}>
                    Insert Image
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeDialog === 'table' && (
          <div className={styles.dialogOverlay} onClick={() => setActiveDialog(null)}>
            <div className={styles.dialogCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dialogHeader}>
                <span className={styles.dialogTitle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3h18v18H3z" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                    <path d="M9 3v18" />
                    <path d="M15 3v18" />
                  </svg>
                  Insert Table Grid
                </span>
                <button type="button" onClick={() => setActiveDialog(null)} className={styles.iconBtn}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleInsertTable}>
                <div className={styles.dialogBody}>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Rows</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={tableRows}
                        onChange={(e) => setTableRows(Math.max(1, Number(e.target.value)))}
                        className={styles.inputControl}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Columns</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={tableCols}
                        onChange={(e) => setTableCols(Math.max(1, Number(e.target.value)))}
                        className={styles.inputControl}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.dialogFooter}>
                  <button type="button" onClick={() => setActiveDialog(null)} className={styles.btnCancel}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPublish}>
                    Insert Table
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );

  if (isInline) {
    return editorContent;
  }

  return <div className={styles.modalOverlay}>{editorContent}</div>;
};
