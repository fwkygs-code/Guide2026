import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Video, CheckSquare, AlertCircle, Image, FileText, Link as LinkIcon, Zap, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BLOCK_TYPES, getBlockIcon, getBlockLabel } from '../../utils/blockUtils';

const BuildingTips = () => {
  const { t, i18n } = useTranslation();
  const [showBlockReference, setShowBlockReference] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const tips = [
    {
      icon: <Video className="w-5 h-5" />,
      title: t('builder.tips.recordGifs'),
      description: t('builder.tips.recordGifsDesc'),
      link: "https://www.screentogif.com/"
    },
    {
      icon: <CheckSquare className="w-5 h-5" />,
      title: t('builder.tips.tickWhenFinished'),
      description: t('builder.tips.tickWhenFinishedDesc'),
    },
    {
      icon: <AlertCircle className="w-5 h-5" />,
      title: t('builder.tips.commonProblems'),
      description: t('builder.tips.commonProblemsDesc'),
    },
    {
      icon: <Image className="w-5 h-5" />,
      title: t('builder.tips.optimizeImages'),
      description: t('builder.tips.optimizeImagesDesc'),
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t('builder.tips.clearTitles'),
      description: t('builder.tips.clearTitlesDesc'),
    },
    {
      icon: <LinkIcon className="w-5 h-5" />,
      title: t('builder.tips.externalLinks'),
      description: t('builder.tips.externalLinksDesc'),
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: t('builder.tips.testMobile'),
      description: t('builder.tips.testMobileDesc'),
    },
    {
      icon: <Video className="w-5 h-5" />,
      title: t('builder.tips.useVideo'),
      description: t('builder.tips.useVideoDesc'),
    },
  ];

  // Block reference data with explanations (EN/HE)
  const blockExplanations = {
    [BLOCK_TYPES.HEADING]: {
      en: 'Add section headings to organize your content. Supports rich text formatting and different sizes.',
      he: 'הוסף כותרות קטע כדי לארגן את התוכן שלך. תומך בעיצוב טקסט עשיר וגדלים שונים.'
    },
    [BLOCK_TYPES.TEXT]: {
      en: 'Add paragraphs, lists, and formatted text. Fully supports rich text editing and RTL languages.',
      he: 'הוסף פסקאות, רשימות וטקסט מעוצב. תומך באופן מלא בעריכת טקסט עשיר ושפות RTL.'
    },
    [BLOCK_TYPES.IMAGE]: {
      en: 'Upload images or GIFs. Supports captions, alt text, and automatic optimization.',
      he: 'העלה תמונות או GIFs. תומך בכיתובים, טקסט חלופי ואופטימיזציה אוטומטית.'
    },
    [BLOCK_TYPES.VIDEO]: {
      en: 'Add video files or YouTube links. Supports custom thumbnails and autoplay settings.',
      he: 'הוסף קבצי וידאו או קישורי YouTube. תומך בתמונות ממוזערות מותאמות אישית והגדרות השמעה אוטומטית.'
    },
    [BLOCK_TYPES.CAROUSEL]: {
      en: 'Create image or GIF carousels. Users can swipe through multiple media items.',
      he: 'צור קרוסלות תמונה או GIF. משתמשים יכולים להחליק בין מספר פריטי מדיה.'
    },
    [BLOCK_TYPES.BUTTON]: {
      en: 'Add action buttons (Next step, External link, or Checkpoints). Fully customizable style.',
      he: 'הוסף כפתורי פעולה (שלב הבא, קישור חיצוני או נקודות ביקורת). סגנון הניתן להתאמה מלאה.'
    },
    [BLOCK_TYPES.DIVIDER]: {
      en: 'Add visual separators between sections. Choose from solid, dashed, or dotted styles.',
      he: 'הוסף מפרידים חזותיים בין קטעים. בחר מסגנונות מלאים, מקווקווים או מנוקדים.'
    },
    [BLOCK_TYPES.SPACER]: {
      en: 'Add vertical spacing between elements. Adjustable height for precise layout control.',
      he: 'הוסף ריווח אנכי בין אלמנטים. גובה מתכוונן לשליטה מדויקת בפריסה.'
    },
    [BLOCK_TYPES.PROBLEM]: {
      en: 'Highlight common problems with solutions. Great for troubleshooting sections.',
      he: 'הדגש בעיות נפוצות עם פתרונות. מצוין לקטעי פתרון בעיות.'
    },
    [BLOCK_TYPES.CHECKLIST]: {
      en: 'Create interactive checklists. Users can check off items as they complete tasks.',
      he: 'צור רשימות משימות אינטראקטיביות. משתמשים יכולים לסמן פריטים כשהם משלימים משימות.'
    },
    [BLOCK_TYPES.CALLOUT]: {
      en: 'Highlight important information with styled callout boxes. Choose from Tip, Warning, or Important variants.',
      he: 'הדגש מידע חשוב עם קופסאות קריאה מעוצבות. בחר מסוגים: טיפ, אזהרה או חשוב.'
    },
    [BLOCK_TYPES.ANNOTATED_IMAGE]: {
      en: 'Add images with interactive annotation markers. Click to place markers with titles and descriptions.',
      he: 'הוסף תמונות עם סמני הערות אינטראקטיביים. לחץ כדי למקם סמנים עם כותרות ותיאורים.'
    },
    [BLOCK_TYPES.EMBED]: {
      en: 'Embed content from YouTube, Vimeo, Loom, Figma, Google Docs, and more. Paste any URL.',
      he: 'הטמע תוכן מ-YouTube, Vimeo, Loom, Figma, Google Docs ועוד. הדבק כל URL.'
    },
    [BLOCK_TYPES.SECTION]: {
      en: 'Group multiple blocks together. Optional collapsible sections for better organization.',
      he: 'קבץ מספר בלוקים יחד. קטעים מתקפלים אופציונליים לארגון טוב יותר.'
    },
    [BLOCK_TYPES.CONFIRMATION]: {
      en: 'Require explicit acknowledgment before proceeding. Checkbox or button style.',
      he: 'דרוש אישור מפורש לפני המשך. סגנון תיבת סימון או כפתור.'
    },
    [BLOCK_TYPES.EXTERNAL_LINK]: {
      en: 'Add prominent CTA buttons linking to external resources. Choose to open in new tab.',
      he: 'הוסף כפתורי CTA בולטים המקשרים למשאבים חיצוניים. בחר לפתוח בכרטיסייה חדשה.'
    },
    [BLOCK_TYPES.CODE]: {
      en: 'Display code snippets or commands. Syntax highlighting and copy button included.',
      he: 'הצג קטעי קוד או פקודות. הדגשת תחביר וכפתור העתקה כלולים.'
    }
  };

  const currentLang = i18n.language === 'he' ? 'he' : 'en';

  // Block labels in both languages
  const blockLabels = {
    [BLOCK_TYPES.HEADING]: { en: 'Heading', he: 'כותרת' },
    [BLOCK_TYPES.TEXT]: { en: 'Text', he: 'טקסט' },
    [BLOCK_TYPES.IMAGE]: { en: 'Image/GIF', he: 'תמונה/GIF' },
    [BLOCK_TYPES.VIDEO]: { en: 'Video', he: 'וידאו' },
    [BLOCK_TYPES.CAROUSEL]: { en: 'Carousel', he: 'קרוסלה' },
    [BLOCK_TYPES.BUTTON]: { en: 'Button', he: 'כפתור' },
    [BLOCK_TYPES.DIVIDER]: { en: 'Divider', he: 'מפריד' },
    [BLOCK_TYPES.SPACER]: { en: 'Spacer', he: 'רווח' },
    [BLOCK_TYPES.PROBLEM]: { en: 'Problem', he: 'בעיה' },
    [BLOCK_TYPES.CHECKLIST]: { en: 'Checklist', he: 'רשימת משימות' },
    [BLOCK_TYPES.CALLOUT]: { en: 'Callout', he: 'קריאה' },
    [BLOCK_TYPES.ANNOTATED_IMAGE]: { en: 'Annotated Image', he: 'תמונה עם הערות' },
    [BLOCK_TYPES.EMBED]: { en: 'Embed', he: 'הטמעה' },
    [BLOCK_TYPES.SECTION]: { en: 'Section', he: 'קטע' },
    [BLOCK_TYPES.CONFIRMATION]: { en: 'Confirmation', he: 'אישור' },
    [BLOCK_TYPES.EXTERNAL_LINK]: { en: 'External Link', he: 'קישור חיצוני' },
    [BLOCK_TYPES.CODE]: { en: 'Code/Command', he: 'קוד/פקודה' }
  };

  // Get all block types for reference
  const allBlocks = [
    BLOCK_TYPES.HEADING,
    BLOCK_TYPES.TEXT,
    BLOCK_TYPES.IMAGE,
    BLOCK_TYPES.VIDEO,
    BLOCK_TYPES.CAROUSEL,
    BLOCK_TYPES.BUTTON,
    BLOCK_TYPES.DIVIDER,
    BLOCK_TYPES.SPACER,
    BLOCK_TYPES.PROBLEM,
    BLOCK_TYPES.CHECKLIST,
    BLOCK_TYPES.CALLOUT,
    BLOCK_TYPES.ANNOTATED_IMAGE,
    BLOCK_TYPES.EMBED,
    BLOCK_TYPES.SECTION,
    BLOCK_TYPES.CONFIRMATION,
    BLOCK_TYPES.EXTERNAL_LINK,
    BLOCK_TYPES.CODE,
  ];

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header with toggle */}
      <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {showBlockReference ? (
              <BookOpen className="w-5 h-5 text-primary" />
            ) : (
              <Lightbulb className="w-5 h-5 text-primary" />
            )}
            <h3 className="text-sm font-semibold text-slate-900">
              {showBlockReference ? (currentLang === 'he' ? 'מדריך לבלוקים' : 'Block Reference') : t('builder.buildingTips')}
            </h3>
          </div>
        </div>
        
        {/* Toggle buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={!showBlockReference ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowBlockReference(false); setSelectedBlock(null); }}
            className="h-8 text-xs"
          >
            <Lightbulb className="w-3 h-3 mr-1" />
            {currentLang === 'he' ? 'טיפים' : 'Tips'}
          </Button>
          <Button
            variant={showBlockReference ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowBlockReference(true)}
            className="h-8 text-xs"
          >
            <BookOpen className="w-3 h-3 mr-1" />
            {currentLang === 'he' ? 'בלוקים' : 'Blocks'}
          </Button>
        </div>
        
        <p className="text-xs text-slate-500 mt-2">
          {showBlockReference 
            ? (currentLang === 'he' ? 'לחץ על בלוק כדי לראות הסבר' : 'Click any block to see details')
            : t('builder.buildingTipsDescription')}
        </p>
      </div>

      {/* Content area */}
      <div className="overflow-y-auto flex-1" style={{ minHeight: 0, flex: '1 1 auto', overflowY: 'auto' }}>
        {!showBlockReference ? (
          // Building Tips
          <div className="p-4 space-y-3">
            {tips.map((tip, index) => (
              <Card key={index} className="bg-white border-slate-200 hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-primary mt-0.5 flex-shrink-0">
                      {tip.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold text-slate-900 mb-1">
                        {tip.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-600 leading-relaxed">
                        {tip.description}
                      </CardDescription>
                      {tip.link && (
                        <a
                          href={tip.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-2 inline-block"
                        >
                          {t('builder.learnMore')} →
                        </a>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          // Block Reference (Interactive)
          <div className="p-4 space-y-2">
            {allBlocks.map((blockType) => (
              <div key={blockType}>
                <button
                  onClick={() => setSelectedBlock(selectedBlock === blockType ? null : blockType)}
                  className={`w-full p-3 rounded-lg border text-left transition-all hover:border-primary hover:shadow-sm ${
                    selectedBlock === blockType 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xl flex-shrink-0">{getBlockIcon(blockType)}</span>
                      <span className="font-medium text-sm text-slate-900 truncate">
                        {blockLabels[blockType]?.[currentLang] || getBlockLabel(blockType)}
                      </span>
                    </div>
                    {selectedBlock === blockType ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
                
                {selectedBlock === blockType && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {blockExplanations[blockType]?.[currentLang] || blockExplanations[blockType]?.en || (
                        currentLang === 'he' 
                          ? 'אין תיאור זמין לבלוק זה.'
                          : 'No description available for this block.'
                      )}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildingTips;
