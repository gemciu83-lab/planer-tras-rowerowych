# Weryfikacja wersji 3.12 — 1.11.2026

Polecenie: node tests/planner.test.cjs. Pełny zestaw obejmuje dotychczasowe regresje i nowe tests/walking.test.cjs.

Sprawdzono: pieszy profil zapytania BRouter i jego parametry, przedział tempa 1–8 km/h, zapis profilu Spacer i rodzaju terenu, kalorie osoby i plecaka bez masy roweru, jednokrotne naliczanie spoczynku oraz wpływ terenu i podjazdu. Test 2 km pętli używa profilu walking, zwraca trzy propozycje i nie zastępuje bieżącej trasy podczas wyszukiwania.

W przeglądarce:

- Przycisk Spacer ustawia 5 km/h, propozycje postojów co 5 km i pętlę 5 km. Znika masa i rodzaj roweru; widoczne są Osoba, Plecak i Teren.
- Rzeczywisty BRouter: jedno zapytanie po publicznych, syntetycznych współrzędnych wyznaczyło spacer około 0,8 km (31 punktów), z wysokościami i opisami nawierzchni. Nie testowano dostępności każdego leśnego przejścia w terenie.
- Tempo 2,5 km/h i teren Utwardzone ścieżki zmieniły czas i kalorie. Zapis i ręczne wczytanie przywróciły te ustawienia oraz postoje co 5 km. Powrót do roweru przywrócił 16 km/h i propozycje co 25 km.
- Zwykłe odświeżenie nadal zaczyna bez trasy. Poprzedni spacer jest dostępny do ręcznego wczytania.
- Widoki 1366 i 390 px bez poziomego przewijania. Sprawdzono ciemne menu terenu oraz chowanie i przywracanie dolnego panelu. Po scaleniu reakcji ResizeObserver w requestAnimationFrame nie wystąpiło ostrzeżenie o pętli zmiany rozmiaru w końcowym teście.

Przyciski podglądu, atrapy GPS i kontrolowane odpowiedzi nie są częścią ZIP. To paczka do samodzielnego wgrania; asystent nie publikuje wersji na GitHub Pages.

## Historia testów poprzedniej wersji

# Weryfikacja wersji 3.11 — 28.10.2026

Polecenie: node tests/planner.test.cjs. Obejmuje wcześniejsze regresje oraz nowe analizy, Worker i aktualizacje.

- Czasy GPX: rozróżnienie aktywności urządzenia, całego zapisu, ruchu i postojów; brak oraz niepoprawne czasy nie są zamieniane na zero.
- Przedziały wiatru: rosnące zakresy, granice, ustawienie po ostatnim przedziale, trwałość zapisu i zgodność kalorii po buforowaniu kierunków.
- Podjazdy, klasy dróg i nawierzchnie: rozpoznawanie odcinków i jawny brak danych.
- Faktyczny kod Workera wykonany dla 40 000 punktów; zgodność z obliczeniami synchronicznymi i poprawne zasilenie pamięci wyników.
- Aktualizacja: porównanie numerów wersji, walidacja manifestu, SHA-256 niekompletnego wdrożenia, jednorazowy token i termin kopii, brak miejsca w magazynie. Niekompletny pakiet i błąd zapisu nie przeładowują strony.

Przeglądarka, lokalny podgląd i syntetyczne dane:

- GPX z 40 000 punktów wczytał się z profilem i podsumowaniem metadanych. Worker wykonał obliczenia w tle; brak błędów JavaScript w kontrolowanym podglądzie.
- Ustawienie wiatru do 60 km zmieniło kalorie i pokazało różnicę względem ciszy. Podpis jest widoczny przy kafelku kalorii.
- Zapis i ręczne wczytanie zachowały nagranie GPX oraz przedziały wiatru. Zwykłe odświeżenie pozostało bez trasy.
- Kontrolowana odpowiedź routingu z drogą primary i szutrem pokazała obie pozycje na liście. Kliknięcie podjazdu zmieniło zakres profilu i wyróżniło fragment mapy.
- Pełna kontrolowana aktualizacja w przeglądarce: sprawdzono manifest i skróty wszystkich plików, przeładowano testowe następne wydanie oraz przywrócono 40 000 punktów, 21 punktów kontrolnych, podsumowanie GPX i przedziały wiatru. Następne zwykłe odświeżenie znów pozostało bez trasy. Testowe następne wydanie istniało wyłącznie w pamięci lokalnego serwera.
- Widok 1366 px: parametry i PNG mają po 40 px wysokości i wspólną pozycję w pionie; brak poziomego przewijania. Sprawdzono też wąski widok przeglądarki.

Lokalny benchmark obliczeń dla 37 830 punktów, mediana 7 prób: geometria 688,5 → 504,2 ms (około 27% mniej), pojedyncze ponowne liczenie energii 368,7 → 212,9 ms (około 42% mniej). Wynik zależy od sprzętu i środowiska testowego. Nie obejmuje startu Workera, renderowania mapy ani odpowiedzi sieciowych. Wynik kalorii przed i po optymalizacji zgadza się z dokładnością znacznie lepszą niż zaokrąglenie wyświetlania.

Nie badano rzeczywistej dokładności spalania kalorii ani aktualnej dostępności wszystkich usług zewnętrznych. Testowe atrapy GPS, odpowiedzi routingu, przyciski podglądu i prywatny GPX nie są częścią paczki. Asystent nie publikuje tej paczki na GitHub Pages.
