import { InternationalString } from '@hyperion-framework/types';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';

export const LanguageString: React.FC<{ [key: string]: any } & { as?: React.FC<any>; language: string }> = ({
  as: Component,
  language,
  children,
  ...props
}) => {
  const { i18n } = useTranslation();

  const viewingDirection = useMemo(() => i18n.dir(language), [language]);

  const isSame = useMemo(() => {
    return (
      i18n.services.languageUtils.getLanguagePartFromCode(i18n.language) ===
      i18n.services.languageUtils.getLanguagePartFromCode(language)
    );
  }, [i18n.language, language]);

  if (isSame) {
    if (Component) {
      return <Component {...props}>{children}</Component>;
    }

    return <span {...props}>{children}</span>;
  }

  if (Component) {
    return (
      <Component {...props} lang={language} dir={viewingDirection}>
        {children}
      </Component>
    );
  }

  return (
    <span {...props} lang={language} dir={viewingDirection}>
      {children}
    </span>
  );
};

export const LocaleString = ({
  as: Component,
  children,
  ...props
}: { [key: string]: any } & { as?: React.FC<any>; children: InternationalString }): JSX.Element => {
  const { i18n } = useTranslation();

  const [language, text] = useMemo(() => {
    if (!children) {
      return [undefined, ''];
    }

    const allLanguages = Object.keys(children);

    // No options.
    if (allLanguages.length === 0) {
      return [undefined, ''];
    }

    // Only one option.
    if (allLanguages.length === 1) {
      return [allLanguages[0], (children[allLanguages[0]] as string[]).join('')];
    }

    // Exact match.
    const exact = children[i18n.language];
    if (exact) {
      return [i18n.language, exact.join('')];
    }

    const root = i18n.language.indexOf('-') !== -1 ? i18n.language.slice(0, i18n.language.indexOf('-')) : null;
    const rootExact = root ? children[root] : null;

    // Rough match.
    if (rootExact) {
      return [i18n.language, rootExact.join('')];
    }

    // Fallback languages, in order.
    for (const lang of i18n.languages) {
      const match = children[lang];
      if (match) {
        return [lang, match.join('')];
      }
    }

    const noneLanguage = children.none || children['@none'] || null;
    if (noneLanguage) {
      return [undefined, noneLanguage.join('')];
    }

    // Final fall-back to the first in the list.
    return [allLanguages[0], (children[allLanguages[0]] || []).join('')];
  }, [children, i18n.language]);

  if (language) {
    return (
      <LanguageString {...props} as={Component} language={language}>
        {text}
      </LanguageString>
    );
  }

  if (Component) {
    return <Component {...props}>{text}</Component>;
  }

  return <span {...props}>{text}</span>;
};
