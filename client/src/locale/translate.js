import f from 'lodash'
import { isDev } from '../env'

// real langs
import en from './en.json'
import de from './de.json'
import es from './es.json'

// dev langs
import xx from './xx.json'
import zz from './zz.json'
// dev lang stuff
const DEV_LANGS = isDev ? { xx, zz } : null
const store = window.sessionStorage
const SELECTED_LANG = store.getItem('LEIHS_DEV_FAKE_USER_LANG')

// XXX global, forces refresh if changed!
//     refresh is needed because we sidestep React
const setLang = l => {
  const old = store.getItem('LEIHS_DEV_FAKE_USER_LANG')
  store.setItem('LEIHS_DEV_FAKE_USER_LANG', l)
  // compare against effective lang (null falls back to DEFAULT_LANG at load time)
  if (l !== (old || DEFAULT_LANG)) window.location.reload()
}
window && (window.setLang = setLang)

const fakeLang = l => {
  store.setItem('LEIHS_DEV_FAKE_USER_LANG', l)
  window.location.reload()
}
window && (window.fakeLang = fakeLang)

const LANGS = { en, de, es, ...DEV_LANGS }
const DEFAULT_LANG = 'de'

const translate = key => {
  const translations = SELECTED_LANG
    ? LANGS[SELECTED_LANG] ||
      LANGS[SELECTED_LANG.split('-')[0]] ||
      LANGS[DEFAULT_LANG]
    : LANGS[DEFAULT_LANG]
  const fallback = `⟪${key}⟫`
  // 'foo.bar.baz' => [ 'foo.bar.baz', 'bar.baz', 'baz' ]
  const paths = key.split('.').map((i, n, a) => a.slice(n).join('.'))
  const results = paths
    .map(k => f.get(translations, k))
    .concat([fallback])
    .filter(r => f.isString(r) || f.isNumber(r))
  return f.first(results)
}
export default translate
