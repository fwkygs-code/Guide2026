import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Video, CheckSquare, AlertCircle, Image, FileText, Link as LinkIcon, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BuildingTips = () => {
  const { t } = useTranslation();
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

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900">{t('builder.buildingTips')}</h3>
        </div>
        <p className="text-xs text-slate-500">{t('builder.buildingTipsDescription')}</p>
      </div>

      <div className="p-6 space-y-4 overflow-y-auto flex-1" style={{ minHeight: 0, flex: '1 1 auto', overflowY: 'auto' }}>
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
    </div>
  );
};

export default BuildingTips;
