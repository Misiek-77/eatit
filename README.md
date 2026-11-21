# Jadłospis

Dziennik kalorii i makroskładników: produkty ze skanu kodu kreskowego (baza Open Food Facts) albo wpisane
z etykiety, porcje, cele dzienne. Działa w przeglądarce i offline, dane zostają na urządzeniu.

## Uruchomienie

```bash
npm install
npm run dev        # wersja robocza
npm test           # testy
npm run build      # gotowa aplikacja w folderze dist
```

Publikacja: każdy push na `main` lub `master` publikuje aplikację na GitHub Pages
(`.github/workflows/deploy.yml`; w repozytorium Settings → Pages → Source: „GitHub Actions”).

## Instalacja na iPhonie

Otwórz adres w Safari → „Udostępnij” → „Do ekranu początkowego”. Aparat do skanowania kodów działa
w aplikacji z ekranu początkowego; przy pierwszym skanie Safari zapyta o zgodę.

## Połączenie z aplikacją Trening

Aplikacja jest zbudowana tak, żeby dało się ją później wcielić do aplikacji Trening bez przenoszenia danych:

- **Kod dziennika jest w jednym folderze:** `src/nutrition/` (logika, dane, ekrany, stan). Po połączeniu
  kopiuje się ten folder do `trening/src/nutrition/`.
- **Ekrany są pod `/dieta`** i są zebrane w `src/nutrition/routes.tsx` (`NUTRITION_ROUTES`). W Treningu
  dokłada się je do listy tras i dodaje zakładkę „Dieta”.
- **Dane w osobnej bazie IndexedDB „jadlospis”**, pod tym samym adresem co Trening (`misiek-77.github.io`).
  Połączona aplikacja otworzy obie bazy tak, jak są — nic nie trzeba migrować.
- **Kopia zapasowa ma znacznik `"app": "jadlospis"`**, a Trening `"app": "trening"`, więc połączona
  aplikacja rozpozna oba pliki.
- **`src/shared/` to kopie elementów Treningu** (okna, pola liczbowe, ikony, motyw, aktualizacje,
  zapis plików, łączenie z bazą). Przy łączeniu zostaje wersja z Treningu; ikony z `shared/Icon.tsx`
  dopisuje się do tamtego pliku.
- **Style:** `src/styles/tokens.css` i `app.css` są takie same jak w Treningu; dziennik ma tylko
  własny `nutrition.css`.
- **`NutritionProvider`** owija aplikację obok `StoreProvider` Treningu; nie dzielą stanu.

### Wspólne dane już teraz

Obie aplikacje są na tym samym adresie (misiek-77.github.io), więc każda może **czytać** bazę drugiej
(`src/shared/otherApp.ts`, w Treningu `src/data/otherApp.ts`). Nigdy jej nie tworzy ani nie zmienia.

- Jadłospis bierze z Treningu dni z treningiem (dodatek kcal w Celach) i wagę z pomiarów ciała.
- Trening pokazuje na wykresie wagi także wagę wpisaną w Jadłospisie.
- „Eksportuj obie aplikacje” zapisuje jeden plik `{ app: "komplet", trening, jadlospis }`. Każda aplikacja
  przywraca z niego swoją część.

Po połączeniu w jedną aplikację te odczyty zastępuje bezpośredni dostęp do obu baz.
