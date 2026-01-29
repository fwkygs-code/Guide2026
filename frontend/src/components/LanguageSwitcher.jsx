import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Sun } from 'lucide-react';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [isAccessibilityLight, setIsAccessibilityLight] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem('accessibilityLightMode');
    const enabled = stored === 'true';
    setIsAccessibilityLight(enabled);
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'accessibility-light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleAccessibilityLight = () => {
    const next = !isAccessibilityLight;
    setIsAccessibilityLight(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'accessibility-light');
      localStorage.setItem('accessibilityLightMode', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('accessibilityLightMode', 'false');
    }
  };

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 relative z-[10006] text-muted-foreground hover:text-foreground"
            data-testid="language-switcher-button"
            data-onboarding-allow="true"
          >
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align={i18n.language === 'he' ? 'start' : 'end'}
          className="bg-popover border-border text-foreground z-[10006]"
          data-onboarding-allow="true"
        >
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={i18n.language === lang.code ? 'bg-accent text-foreground' : 'hover:bg-accent/50 text-foreground'}
              data-testid={`language-option-${lang.code}`}
            >
              <div className="flex items-center justify-between w-full">
                <span>{lang.nativeName}</span>
                {i18n.language === lang.code && (
                  <span className="text-xs text-muted-foreground">✓</span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        onClick={toggleAccessibilityLight}
        data-testid="accessibility-light-toggle"
      >
        <Sun className="w-4 h-4" />
        <span className="hidden sm:inline">Light mode</span>
      </Button>
    </div>
  );
};

export default LanguageSwitcher;
