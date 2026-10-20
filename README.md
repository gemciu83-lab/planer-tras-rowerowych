# Planer tras rowerowych

Wersja 2.5 — planer wycieczek rowerowych z mapą, GPS i profilem wysokości.

## Uruchomienie w Windows

1. Pobierz pliki repozytorium przez **Code → Download ZIP** i rozpakuj całość.
2. Kliknij **URUCHOM.cmd**. Planer otworzy się pod adresem http://127.0.0.1:8765/.
3. Zezwól przeglądarce na lokalizację, jeśli chcesz ustawić start przez GPS.
4. Po zakończeniu użyj **ZAMKNIJ.cmd**, aby zatrzymać lokalny serwer.

Nie trzeba instalować Node.js ani dodatkowych bibliotek. Do map, wyszukiwania adresów i wyznaczania tras potrzebny jest internet. Szczegółowa obsługa: [INSTRUKCJA.txt](INSTRUKCJA.txt).

## Możliwości

- Start S z GPS lub wybranego miejsca, przeciąganie punktów i numeracja przystanków.
- Wyznaczanie tras rowerowych i wyszukiwanie do trzech propozycji pętli.
- Profil wysokości, nachylenia, szacunkowy czas i kalorie z parametrami rowerzysty oraz roweru.
- Nazwy punktów, cofanie zmian i obsługa dotykowa.
- Import i eksport GPX, zapisywanie wycieczek w przeglądarce.
- Eksport mapy, profilu lub mapy z profilem do PNG.

Po uruchomieniu planer zaczyna bez ostatniej trasy. Zapisane wycieczki wczytuje się ręcznie. Dane zapisane w przeglądarce nie są częścią repozytorium.

## Kod i sprawdzanie zmian

`planer.html` zawiera interfejs, `assets/planner.css` wygląd, `assets/app.js` obsługę aplikacji, `assets/planner-core.js` obliczenia, a `assets/planner-features.js` dodatkowe funkcje. Skrypty PowerShell uruchamiają i zatrzymują lokalny serwer.

Do testów deweloperskich potrzebny jest Node.js:

```sh
npm test
```

Testy obejmują wybór i anulowanie pętli, zachowanie bieżącej trasy, nazwy punktów, obsługę dotykową oraz powiązania kontrolek z kodem. Nie zastępują sprawdzenia GPS i usług mapowych w przeglądarce.

## Źródła map i danych

Interfejs mapy korzysta z [Leaflet](https://leafletjs.com/). Mapy i dane pochodzą m.in. z OpenStreetMap, CyclOSM i Esri; oznaczenia dostawców są wyświetlane na mapie. Trasy wyznacza BRouter, a nazwy miejsc dostarcza Photon. Dostępność usług wpływa na działanie planera.

Oznaczenia autorów dołączone do plików bibliotek należy zachować. Repozytorium nie nadaje dodatkowej licencji kodowi aplikacji.
