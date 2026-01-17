import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Video, CheckSquare, AlertCircle, Image, FileText, Link as LinkIcon, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BuildingTips = () => {
  const { t } = useTranslation();
  const tips = [
    {
      icon: <Video className="w-5 h-5" />,
      title: "Record GIFs with ScreenToGIF",
      description: "Use ScreenToGIF (free Windows app) to record screen captures as animated GIFs. Perfect for step-by-step demonstrations.",
      link: "https://www.screentogif.com/"
    },
    {
      icon: <CheckSquare className="w-5 h-5" />,
      title: "Set Step to Tick When Finished",
      description: "Change navigation type to 'Check-off Required' to make users confirm completion before advancing. Great for important steps.",
    },
    {
      icon: <AlertCircle className="w-5 h-5" />,
      title: "Add Common Problems Block",
      description: "Click on a step, then select 'Common Problems' to add troubleshooting tips. Helps users solve issues independently.",
    },
    {
      icon: <Image className="w-5 h-5" />,
      title: "Optimize Images Before Upload",
      description: "Compress images to reduce file size and improve loading speed. Use tools like TinyPNG or Squoosh for best results.",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Use Clear Step Titles",
      description: "Write concise, action-oriented titles. Users should understand what they'll do in each step at a glance.",
    },
    {
      icon: <LinkIcon className="w-5 h-5" />,
      title: "Link to External Resources",
      description: "Add links in text blocks to reference documentation, videos, or other helpful resources for deeper learning.",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Test on Mobile Devices",
      description: "Preview your walkthrough on mobile to ensure it looks good and works smoothly on smaller screens.",
    },
    {
      icon: <Video className="w-5 h-5" />,
      title: "Use Video for Complex Actions",
      description: "For multi-step processes, consider using video instead of static images. Videos can show the full sequence clearly.",
    },
  ];

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-slate-900">Building Tips</h3>
        </div>
        <p className="text-xs text-slate-500">Helpful tips for creating effective walkthroughs</p>
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
