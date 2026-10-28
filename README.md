# Planer tras rowerowych 3.11

## Wgranie na GitHub Pages

1. Rozpakuj ZIP.
2. Do głównego katalogu repozytorium wgraj **index.html, version.json i cały folder assets**, zastępując poprzednie pliki. Nie wgrywaj samego ZIP ani folderu nadrzędnego.
3. Zatwierdź zmiany i poczekaj na zakończenie wdrożenia Pages.
4. Otwórz stronę. Przycisk w nagłówku i tytuł karty mają pokazać **3.11.0**. Przy pierwszym przejściu ze starszej wersji zapisz trasę przed odświeżeniem.

Paczka jest statyczną stroną dla serwera HTTP/HTTPS, w tym GitHub Pages. Folder tests służy do lokalnej weryfikacji kodu.

## Zapis GPX: czas i dystans

Po imporcie pod mapą pojawia się panel **Zapis GPX**. Rozróżnia dystans urządzenia, sumę odległości między punktami, czas aktywności urządzenia, pełny czas zapisu oraz szacunkowy ruch i postoje.

- Odczytywane są znaczniki czasu punktów i dostępne rozszerzenia totalDistance, totalTime, cumulativeClimb, cumulativeDecrease. Rozszerzenia nie są obowiązkową częścią GPX; brak danych jest pokazany wprost.
- Szacunek ruchu używa okien 30 s i progu 3 km/h. Przerwy między próbkami ponad 5 min, cofnięty czas, brak czasu i prędkości ponad 100 km/h nie są przypisywane arbitralnie do ruchu lub postoju. Niepełność jest opisana. Nie jest to odtworzenie algorytmu automatycznej pauzy zegarka.
- Import nie nadpisuje tempa, mas ani planowanych postojów. Przycisk **Ustaw tempo…** pozwala świadomie skopiować średnią prędkość z zapisu. Czas planowanej wyprawy nadal wynika z bieżącej geometrii, tempa i zaplanowanych przerw.
- Po edycji geometrii panel pozostaje podsumowaniem oryginalnego nagrania, z wyraźnym oznaczeniem zmiany. Nie przypisujemy starych czasów nowym odcinkom.
- Podsumowanie nagrania zachowuje się w ręcznym zapisie wyprawy i historii. Nie wysyłamy GPX do usługi analitycznej. Eksport śladu GPX nadal jest eksportem geometrii z wysokościami, bez generowania nowych znaczników czasu.

## Wiatr i kalorie

Na kafelku kalorii widać **Bez wiatru**, **Wiatr: … km/h**, **Wiatr: odcinki** lub stan prognozy. Kliknięcie podpisu otwiera ustawienia energii. Pokazujemy również porównanie z tą samą trasą bez wiatru; różnica nie jest przedziałem błędu pomiaru.

W **Ustawienia → Wiatr i kalorie → Ręcznie — różne odcinki** dodasz np. wiatr do 60. kilometra, a potem inne warunki. Wiersze mają rosnący kilometr końca. Po ostatnim obowiązuje wiatr z głównych pól powyżej; pozostaw tam 0, jeśli dalej ma być cisza. Kierunek oznacza **skąd wieje**, a model uwzględnia rzeczywisty kierunek jazdy na każdym fragmencie. Usunięcie wiersza scala jego zakres z kolejnym lub z ustawieniem ogólnym. Maksymalnie 30 przedziałów.

Przedziały zapisują się z wyprawą, działają z Cofnij/Ponów i nie wysyłają zapytań trasowania. Obecna prognoza nadal jest pobierana wyłącznie po kliknięciu. Zmiana przedziałów anuluje oczekujące pobieranie pogody, żeby spóźniona odpowiedź nie zmieniła wyboru.

Nie dodano stałego mnożnika kalorii dla długich tras. Zachowano podział na aktywne i całkowite oraz dotychczasowe założenia modelu.

## Odcinki do sprawdzenia

Rozwiń panel pod mapą: najdłuższy podjazd, pozostałe podjazdy, trudniejsze nawierzchnie i drogi główne. Kliknięcie przybliża fragment mapy, wyróżnia go i ustawia zakres profilu. Przycisk **Usuń wyróżnienie z mapy** usuwa zaznaczenie.

- Podjazdy: przynajmniej 200 m i 20 m w górę; nachylenie od 1%, z krótkimi łagodnymi przerwami do 100 m. Najdłuższy jest wyróżniony na początku listy.
- Nawierzchnie: szuter, grunt, piasek i inne opisane nieasfaltowe rodzaje, od 100 m.
- Drogi: klasy OSM trunk, primary, secondary i ich łącznice, od 100 m. Klasa nie jest pomiarem natężenia ruchu ani pewnym rozpoznaniem każdej administracyjnej DW. Opisy BRouter są rozciągane proporcjonalnie do geometrii, więc początki i końce tych odcinków są przybliżone.
- Zwykły GPX nie zawiera opisów dróg i nawierzchni. Panel wskazuje pokrycie danych i nie przedstawia braku opisów jako gwarancji spokojnej trasy. Lista pokazuje maksymalnie 40 pozycji, z informacją o skróceniu.

## Aktualizacje

Przycisk **v3.11.0 ↻** sprawdza version.json na tej samej stronie. Sprawdzenie następuje także po starcie, co 15 min w widocznej karcie oraz po powrocie do karty, jeśli minęło 5 min. Nie ma automatycznego przeładowania ani Service Workera.

Po wykryciu nowszej wersji **Zaktualizuj i zachowaj pracę**:

1. Sprawdza SHA-256 strony i wszystkich plików aplikacji z manifestu. Niekompletne wdrożenie zatrzymuje aktualizację.
2. Zachowuje bieżące punkty, ślad, parametry i metadane w pamięci sesji tej karty. Brak miejsca zatrzymuje przeładowanie.
3. Otwiera nową wersję i przywraca tę kopię tylko z jednorazowym tokenem aktualizacji, ważnym 15 min. Nie przenosi historii Cofnij/Ponów ani pobranej prognozy pogody; prognozę należy pobrać ponownie.

**Zwykłe uruchomienie lub odświeżenie nadal zaczyna bez poprzedniej trasy.** Przywrócenie dotyczy wyłącznie świadomie klikniętej aktualizacji. Aktualizowanie na serwerze nadal wymaga wgrania nowych plików przez właściciela repozytorium; przycisk nie publikuje kodu na GitHub.

Po własnych zmianach plików uruchom **node tools/build-manifest.cjs**, aby wygenerować zgodny version.json. Starsza wersja 3.10 nie ma tego mechanizmu — pierwsze wgranie 3.11 trzeba odświeżyć ręcznie.

## Obliczenia i płynność

Przy co najmniej 5000 punktów profil, podjazdy, nachylenia, długości odcinków i kierunki są przygotowywane przez lokalny Web Worker. Wynik jest przypisany do konkretnego niezmiennego śladu i trafia do wspólnej pamięci obliczeń. Starsze zadanie nie może zastąpić nowszej trasy. Dotyczy importu, zatwierdzania routingu, lokalnej edycji GPX i ręcznego wczytywania zapisanej wyprawy.

Ponowne przeliczanie kalorii korzysta z gotowych kierunków odcinków, a profil z gotowych odległości. Gdy Worker jest niedostępny lub zawiedzie, pozostają zwykłe obliczenia. Routing nadal korzysta z pamięci odcinków i respektuje ograniczenia serwera; tej zmiany nie należy traktować jako obietnicy szybszej odpowiedzi BRouter.

Źródła techniczne: [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [opisy odcinków BRouter](https://github.com/abrensch/brouter/blob/master/brouter-core/src/main/java/btools/router/MessageData.java).

## Testy

Uruchom **node tests/planner.test.cjs**. Opis wykonanej weryfikacji: TESTY.md.

## Pozostała obsługa

## GPX: profil i edycja

- GPX z wartościami `ele` od razu pokazuje profil. Odczyt obsługuje przestrzenie nazw, ślady `trkpt` oraz trasy `rtept`. Zero i ujemne wysokości są prawidłowymi danymi. Brak `ele` nie jest zamieniany na zero.
- Przy imporcie zachowujemy wszystkie współrzędne śladu. Tworzymy dodatkowe punkty do edycji wzdłuż przebiegu, zwykle około dwudziestu na krótszej trasie lub co około 5 km na dłuższej. Nie ogranicza to liczby punktów, które można dodać. W starszej wersji import tworzył jedynie start i metę.
- Przesunięcie punktu lub linii wyznacza tylko odcinek między sąsiednimi punktami kontrolnymi. Pozostałe wierzchołki śladu pozostają identyczne. Do zakończenia obliczeń widoczny jest poprzedni ślad. Brak połączenia, błąd serwera lub anulowanie nie usuwa trasy ani jej punktów.
- Jeżeli nowy odcinek jest przyciągnięty do innej drogi i nie łączy się z GPX w granicy 1 m, zmiana zostanie odrzucona. Nie dopisujemy sztucznych łączników w linii prostej. Surowy ślad GPS poza siecią dróg może z tego powodu wymagać innego miejsca edycji. Tryb Ręcznie świadomie tworzy linie proste.
- Możesz dodać punkt, usunąć punkt pośredni lub odwrócić GPX. Usunięcie skrajnego punktu skraca ślad do kolejnego punktu. Przesunięcie wspólnego startu i mety pętli zachowuje pętlę, zmieniając tylko sąsiednie odcinki przy starcie. Cofanie i ponawianie obejmuje te zmiany.
- Zmiana profilu lub preferencji sama nie usuwa GPX; ustawienia zostaną użyte przy następnej lokalnej edycji. Osobny przycisk Wyznacz trasę nadal służy do świadomego przeliczenia całej trasy po punktach.
- Ręczny zapis wyprawy przechowuje również powiązania punktów z GPX i źródło wysokości. Po wczytaniu zapisanej wycieczki można kontynuować lokalną edycję. Starsze zapisy importów są przekształcane do edytowalnego modelu podczas wczytania.

## GPX bez wysokości

Kliknij **Pobierz wysokości** nad wykresem. Sam import nie wysyła śladu do usługi wysokości. Po kliknięciu do Open-Meteo wysyłamy do 600 próbek współrzędnych, zaokrąglonych do 5 miejsc po przecinku, w paczkach do 100. Nie wysyłamy nazwy pliku, nazw punktów ani całego pliku GPX.

Brakujące wartości uzupełniane są modelem terenu Copernicus DEM 90 m, z interpolacją między próbkami; oryginalne wysokości pozostają zachowane. To przybliżenie terenu, nie pomiar z licznika i nie dokładny model mostów, tuneli czy krótkich stromych odcinków. Nie gwarantuje dokładnej sumy podjazdów. Współrzędne i kilometraż nie zmieniają się. Dane są dodawane dopiero po kompletnym, prawidłowym wyniku; błąd, anulowanie lub zmiana trasy w trakcie pobierania nie nadpisuje GPX. Można cofnąć uzupełnienie wysokości.

Źródła danych: [Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api), [Copernicus DEM / ESA](https://doi.org/10.5270/ESA-c5d3d65). Dostępność usługi zależy od internetu i jej limitów. W plikach zawierających kilka oddzielnych odcinków trzeba wybrać jeden ciągły ślad — nie łączymy rozłącznych tras automatycznie.

## Postoje bezpośrednio na mapie

- Kafelek **Postoje** zawiera dwa edytowalne pola: **km** oznacza odstęp między propozycjami, **min** czas nowego postoju. Przykład: 20 km i 12 min oznacza propozycje co 20 km z domyślną przerwą 12 minut.
- Prawidłowe wartości są uwzględniane od razu podczas wpisywania. Obsługiwany zakres to 5–250 km i 1–1440 min, w pełnych jednostkach. Nieprawidłowy wpis nie zmienia planu; po opuszczeniu pola przywracana jest ostatnia prawidłowa wartość.
- Zmiana odstępu aktualizuje żółte propozycje. Zmiana minut dotyczy przyszłych przerw; już zaakceptowane postoje zachowują własny czas. Propozycję trzeba nadal zatwierdzić na mapie, zanim zacznie być doliczana do czasu wyprawy.
- Mały przycisk **…** w kafelku otwiera listę postojów i szczegółowe ustawienia. Pola na mapie i w oknie są synchronizowane w obie strony. Zmiany nie wyznaczają ponownie drogi.
- X chowa także kafelek postojów. Pełny ekran i PNG pozostają widoczne. Przywrócenie paska zachowuje wpisane wartości.

## Parametry przy uruchomieniu

- Masa rowerzysty: ostatnia prawidłowo zapamiętana wartość, a przy pierwszej wizycie 70 kg. Ze starszej wersji przenoszona jest tylko ta masa.
- Bagaż: 2 kg; profil trasy: Turystyczny / trekking; rodzaj roweru: Trekking / miejski.
- Pozostałe wartości nowej sesji: tempo 16 km/h, masa roweru 22 kg, dodatkowy zapas postojów 0 min, pozycja domyślna, wiatr ręczny 0 km/h. Preferencje dróg są wyzerowane. Propozycje odpoczynku wracają do 25 km i 10 minut.
- Zmiany tych pól działają podczas bieżącej sesji i w historii cofania. Jeśli ręcznie zapiszesz wycieczkę, jej parametry nadal zostaną zachowane i można je przywrócić przez świadome wczytanie tej wycieczki. Zapisane wyprawy nie są usuwane.
- Mapa nadal zaczyna bez poprzedniej trasy; automatyczny GPS może ustawić start S. Ustawienia wyglądu, takie jak schowanie paska, są nadal zapamiętywane niezależnie od parametrów wycieczki. Zachowano też wybór automatycznego przeliczania oraz wymaganą przerwę po odmowie serwera.

## Wąski pasek parametrów

- Na dole mapy są obok siebie: **profil trasy, tempo, masa rowerzysty, masa roweru, masa bagażu, rodzaj roweru i Postoje**. Każdy kafelek jest osobnym elementem o wysokości 40 px. Pola nie mają drugiego obramowanego pudełka wewnątrz. Wspólny rząd zaczyna się 12 px od lewej krawędzi mapy, a kończy przyciskiem PNG 12 px od prawej. Kafelki wykorzystują dostępne miejsce, bez ograniczenia szerokości do 850 px i bez dodatkowego przycisku koła zębatego. Na ekranach szerszych niż 950 px wszystkie narzędzia są w jednej linii; na mniejszych ekranach parametry przechodzą ponad przyciski, a na telefonach do kolejnych rzędów.
- Listy **Profil trasy** i **Rodzaj roweru** mają własne ciemne menu, niezależne od białych okien systemowych. Otwierają się nad polem. Wybierz opcję myszą lub strzałkami i Enter; Escape zamyka bez zmiany, Tab przechodzi do następnego pola. Kliknięcie poza listą także ją zamyka. Zaznaczenie aktywnego pola jest na obwodzie całego kafelka, więc nie zakrywa podpisu.
- **Profil trasy** wybiera sposób wyznaczania drogi: turystyczny, szosa, MTB lub ręczne linie. Zmiana korzysta z tego samego automatu co pole w górnych ustawieniach. **Rodzaj roweru** jest szóstym kafelkiem: trekking/miejski, gravel, szosowy lub MTB; zmienia model energii bez pobierania nowej geometrii. Pozycja jazdy, wiatr i szczegółowe rozbicie kalorii pozostają w **Ustawieniach** u góry strony.
- **Bagaż · kg** jest osobnym polem tuż po **Rower · kg**. Edycja działa od razu i jest zsynchronizowana z ustawieniami oraz zapisem wycieczki.
- Kliknij **×**, aby schować cały dolny pasek do małej zakładki **⚙ Parametry**. Kliknięcie zakładki przywraca wszystkie pola. Kafelki dystansu, kalorii i czasu po prawej pozostają widoczne.
- Klawisz **P** także przełącza cały panel. Skrót nie działa podczas wpisywania danych, używania list wyboru ani w otwartym oknie dialogowym. Widoczność panelu jest zapamiętywana niezależnie od trasy i historii cofania. Starszy zapis widoczności kafelków jest obsługiwany.
- Chowanie i przywracanie nie usuwa punktów, nie zmienia parametrów ani nie wyznacza ponownie trasy. Parametry i wyniki pozostają zsynchronizowane z ustawieniami u góry.
- Kafelek **Postoje** należy do dolnego paska parametrów i chowa się razem z nim. Pełny ekran i PNG pozostają widoczne po prawej. Dopasowanie całej trasy i początkowe centrowanie GPS uwzględniają pasek.
- Po uruchomieniu nadal nie wczytujemy poprzedniej trasy. Styl mapy i przycisk GPS pozostają u góry mapy.
- Znaczniki zaplanowanych postojów i propozycji mają literę **P**. Propozycje są żółte, zaplanowane postoje zielone; podpis nadal wyjaśnia rodzaj przerwy. Renderer PNG także używa P.

## Bagaż, wiatr i kalorie

- **Ustawienia → Rowerzysta, rower i bagaż**: masa roweru bez bagażu, osobna masa sakw/plecaka/ekwipunku i pozycja na rowerze. Masę bagażu zmienisz także w **dolnym panelu mapy**. Nowa sesja zaczyna z bagażem 2 kg; starsze zapisane wyprawy bez pola bagażu nadal zachowują 0 kg. Jeśli wcześniej wpisano rower wraz z sakwami, najpierw odejmij sakwy od masy roweru.
- **Pozycja** zmienia założony opór powietrza: wyprostowana, turystyczna lub mocno pochylona. Opcja domyślna korzysta z dotychczasowego ustawienia dla typu roweru. Opór toczenia pozostaje zależny od typu roweru, a nie od udziału nawierzchni z OSM.
- **Ustawienia → Wiatr i kalorie**: ręcznie wpisz prędkość wiatru i kierunek, **z którego wieje**. N = z północy, W = z zachodu. Domyślne 0 km/h oznacza wyraźne założenie bez wiatru. Dla każdego odcinka obliczamy kierunek jazdy i względny wektor powietrza, również przy bocznym wietrze. Silny wiatr w plecy może ograniczyć potrzebę pedałowania; nie daje ujemnych kalorii.
- **Pobierz wiatr dla trasy**: jeden przycisk pobiera godzinną prognozę Open-Meteo dla 2–5 miejsc wzdłuż wyznaczonej trasy. Współrzędne wysyłane są zaokrąglone do 0,001°. Pobieranie odbywa się po kliknięciu, nie automatycznie przy każdym punkcie. Wymaga internetu i daty wyjazdu od teraz do 15 dni naprzód. Po sukcesie wybierany jest tryb prognozy.
- Prognoza dobierana jest do przewidywanej godziny na każdym odcinku, z uwzględnieniem wcześniejszych zaplanowanych postojów. Ogólny dodatkowy zapas nie ma przypisanego miejsca, więc nie przypisujemy go arbitralnie do konkretnej godziny na trasie. Wiatr zmienia energię potrzebną do utrzymania wpisanego tempa; nie zmienia wpisanego tempa ani ETA.
- W trybie prognozy brak danych, niewystarczający zakres godzin, zmiana geometrii lub prognoza starsza niż godzinę wymagają pobrania danych ponownie. Nie pokazujemy wtedy kalorii policzonych przy udawanym bezwietrzu. Można przełączyć na wiatr ręczny. Pobrana prognoza pozostaje w pamięci karty, nie jest zapisywana jako trwała prognoza w wycieczce; po ponownym otwarciu należy pobrać ją jeszcze raz.
- **Aktywne**: modelowany wysiłek potrzebny do jazdy ponad spoczynek. Korzystamy z pracy mechanicznej, sprawności napędu 97% i założonej **sprawności netto 24%**. Masa mechaniczna = rowerzysta + rower + bagaż. **Całkowite** dodają do aktywnych dokładnie jeden wydatek spoczynkowy samego rowerzysty, około 1 kcal/kg/h przez czas jazdy i postojów. Nie doliczamy masy roweru ani sakw do metabolizmu.
- Na mapie główny wynik to aktywne, a mniejszy podpis pokazuje całkowite. W ustawieniach jest rozbicie spoczynkowych na jazdę i postoje. Wyniki główne zaokrąglamy do 10 kcal; są przybliżeniem, nie pomiarem ani obietnicą dokładności fizjologicznej. Sprawność netto nie jest stała u każdej osoby. Nie modelujemy kosztu kadencji, rozpędzania ani dodatkowej pracy organizmu podczas toczenia bez pedałowania.
- Prognoza dotyczy standardowego wiatru na 10 m; osłona lasów, zabudowy i lokalne porywy zmieniają faktyczny wiatr odczuwany przez rowerzystę. Model ma stałą gęstość powietrza i uproszczoną aerodynamikę, bez wspomagania elektrycznego.
- Zmiana mas, pozycji, wiatru i postojów **nie pobiera ponownie geometrii trasy**. Ustawienia pozostają w bieżącej sesji, ręcznie zapisanych wyprawach oraz historii cofania/ponawiania. Automatycznie między sesjami zachowywana jest tylko masa rowerzysty.

Źródła założeń: [wydatek spoczynkowy 1 MET](https://pacompendium.com/), [różnica między sprawnością netto i brutto w badaniu jazdy przy 50 W](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867372/), [model fizyczny jazdy](https://pubmed.ncbi.nlm.nih.gov/7615475/), [API i jednostki prognozy Open-Meteo](https://open-meteo.com/en/docs). Wyniki modelu planera nie są bezpośrednią kopią metody MET ani wyniku konkretnego zegarka.

## Szybszy start i obliczenia

- Lokalizacja uruchamia się automatycznie. Pierwszy poprawny pomiar od razu ustawia **S** i pozwala kliknąć punkt **1**. Usunięto dodatkowe oczekiwanie 1,2–8 sekund na dokładniejszy pomiar.
- Jeśli przeglądarka udostępnia pomiar z ostatniej minuty, planer może użyć go od razu. Starszy pomiar jest opisany jako „ostatni pomiar” wraz z jego wiekiem w ustawieniach lokalizacji. Równolegle pobierana jest świeża pozycja. Nie zapisujemy współrzędnych GPS w nowym trwałym magazynie.
- GPS doprecyzowuje samotny, nietknięty start w tle przez maksymalnie 15 sekund. Po dodaniu punktu 1 albo ręcznej zmianie startu nie przesuwa już trasy. „Moja lokalizacja” pozwala świadomie ponownie ustawić S. Automatyczny pomiar nie nadpisuje wczytanej wycieczki.
- Pierwsza wizyta wymaga zgody na lokalizację. Bez dostępnego niedawnego pomiaru trzeba poczekać na urządzenie. Brak zgody lub pomiaru pozwala ustawić start ręcznie; rzeczywistego GPS nie można zagwarantować natychmiast.
- Automat czeka **0,6 s** od ostatniej zmiany punktów, wcześniej 1,5 s. Seria szybkich kliknięć nadal tworzy jedno zapytanie dla najnowszego układu punktów.
- Przy dopisaniu punktu na końcu planer wykorzystuje zapisany początek trasy i pobiera tylko końcowy odcinek. Dokładne powtórzenie trasy może skorzystać z pamięci bez pobierania. Pamięć trwa do 15 minut w otwartej karcie i uwzględnia profil oraz preferencje dróg. Gdy brakuje dwóch odcinków, wysyłane jest jedno pełne zapytanie zamiast dwóch osobnych. Niezgodne połączenie geometrii powoduje pełne przeliczenie.
- Zachowano pojedynczą kolejkę zapytań, minimum 5 sekund przerwy po odpowiedzi i respektowanie HTTP 403/429 oraz Retry-After. Czas odpowiedzi serwera i długich tras nadal zależy od usługi i sieci.
- Ostatnia wycieczka nadal nie wczytuje się automatycznie. Start S z GPS nie jest przywróceniem poprzedniej trasy.

## Wgranie na GitHub Pages

Najpierw zapisz bieżącą trasę. Rozpakuj ZIP i wgraj do głównego katalogu repozytorium **index.html, version.json oraz cały folder assets**, zastępując poprzednią wersję. Pliki tests, README.md i TESTY.md można również zachować w repozytorium. Paczka nie zawiera lokalnych atrap GPS/pogody ani serwera testowego. W tytule strony i metadanych znajduje się numer **3.11.0**. Sama zmiana końcówki adresu nie podmienia plików aplikacji. Po opublikowaniu nowych plików otwórz stronę w nowej karcie; wycieczkę wczytaj ręcznie.

## Nowość: przerwy na mapie

- Po wyznaczeniu lub wczytaniu trasy pojawiają się żółte znaczniki **„Odpoczynek?”**, domyślnie co 25 km. To propozycje pozycji na śladzie, a nie potwierdzone sklepy, ławki czy miejsca odpoczynku w terenie.
- Kliknij ikonę lub jej podpis, ustaw czas i wybierz **„Zaplanuj ten postój”**. Znacznik zmieni się na zielony **„Postój 10 min”**. Dopiero zaakceptowany postój wpływa na czas wyprawy i kolejne godziny przyjazdu.
- W dolnym kafelku **Postoje** zmienisz odstęp (domyślnie 25 km) oraz domyślny czas przerwy (10 min). Przycisk **…** otwiera szczegóły, gdzie schowasz propozycje i usuniesz zaplanowane przerwy. Zmiana domyślnego czasu dotyczy kolejnych propozycji; nie nadpisuje już zaplanowanych przerw.
- Postoje wpisane przy punktach wycieczki także mają zielony znacznik na mapie. Kliknij go, aby zmienić czas lub usunąć przerwę.
- Przerwy na kilometrze nie są nowymi punktami trasowania: ich edycja nie zmienia kilometrażu ani nie wysyła zapytań do serwera tras. Nie proponujemy kolejnej przerwy do 500 m od już zaplanowanej ani w ostatnich 500 m przed metą.
- Przerwy zapisują się z wycieczką i działają z cofaniem/ponawianiem zmian. Po zmianie przebiegu wycieczki przerwa „25 km” pozostaje na 25. kilometrze od startu nowego przebiegu. Jeśli skrócisz trasę przed ten kilometr, nie doliczamy takiej przerwy; jej wpis pozostaje do usunięcia lub ponownego wykorzystania po wydłużeniu trasy.
- Przy uruchomieniu mapa nadal pozostaje pusta. Wczytaj zapisaną wycieczkę ręcznie.

## Obsługa

- **Ustawienia → Twoje drogi i nawierzchnia**: preferowanie asfaltu/utwardzonych dróg, tras rowerowych i lokalnych dróg; unikanie DW/ruchliwych dróg. Dodatkowe preferencje działają w profilu Turystyczny / trekking. Pozostałe profile mają własne zasady i pokazują, że te przełączniki są nieaktywne. Zmiana preferencji przelicza trasę, jeśli automat jest włączony.
- **Ustawienia → Punkty trasy**: wpisz minuty postoju przy wybranym punkcie. Nie trzeba ponownie pobierać trasy. Postoje uwzględniane są w czasie całej wyprawy i w godzinach przyjazdu do kolejnych punktów. Postój na mecie zaczyna się po przyjeździe; nie opóźnia godziny przyjazdu na metę.
- **Tempo i godzina wyjazdu → Plan przejazdu i postoje**: lista godzin przyjazdu. Pole „Dodatkowe przerwy / zapas” dolicza ogólny zapas do czasu wyprawy, niezależnie od postojów przypisanych do punktów. Nie przypisujemy go arbitralnie do godzin w punktach.
- **Miejsca przy trasie**, pod mapą: wyszukaj sklepy, wodę pitną i miejsca odpoczynku do 500 m od śladu. Kategorie można ukrywać. Znaczniki S/W/O oznaczają sklep/wodę/odpoczynek; punkty trasy pozostają numerowane. „+ Postój” wstawia miejsce we właściwą kolejność, przypisuje 10 minut i uruchamia przeliczenie dojazdu. Czas można zmienić przy punkcie.
- **Zapisz trasę** zachowuje też postoje i preferencje. Przy uruchamianiu mapa nadal pozostaje pusta; zapisane wyprawy wczytuje się ręcznie. Starsze zapisy są obsługiwane. Zwykły eksport śladu GPX nie przenosi ustawień planera ani postojów.

## Co oznaczają preferencje

To preferencje wyboru drogi, a nie zakazy. BRouter korzysta z klas i opisów OpenStreetMap. Nie zapewniamy ścisłego wykluczenia każdej administracyjnej drogi wojewódzkiej w Polsce. Odcinki przy punktach lub bez alternatywy mogą nadal prowadzić taką drogą. Szlak rowerowy może być nieutwardzony; preferencja asfaltu nie gwarantuje całej trasy po asfalcie. Brak danych jest nadal wyraźnie oznaczony.

Wyszukiwanie miejsc korzysta z publicznego Overpass API (instancja Private.coffee). Obejmuje m.in. sklepy spożywcze/piekarnie, punkty wody pitnej, miejsca piknikowe, wiaty i miejsca odpoczynku. Wyniki nie stanowią pełnego spisu obiektów w terenie. Odległość od trasy jest liczona w linii prostej, nie jako dojazd. Potwierdź dostępność i oznakowanie wody na miejscu. Limit odpowiedzi serwera, jeśli zostanie osiągnięty, jest sygnalizowany; duże listy są skracane w panelu, z zachowaniem znaczników na mapie.

Wyszukiwanie uruchamia się na żądanie. Wyniki są buforowane, żądania mają odstęp co najmniej 30 sekund, limit czasu i respektują Retry-After. Błąd lub przerwanie wyszukiwania miejsc nie usuwa wyznaczonej trasy. Kolejka trasowania i ochrona po HTTP 403/429 pozostają aktywne.

Dokumentacja źródeł:

- [Parametry API BRouter](https://github.com/abrensch/brouter/blob/master/brouter-server/src/main/java/btools/server/request/ServerHandler.java)
- [Profil trekking i jego przełączniki](https://github.com/abrensch/brouter/blob/master/misc/profiles2/trekking.brf)
- [Wyszukiwanie wokół linii w Overpass API](https://dev.overpass-api.de/overpass-doc/en/full_data/polygon.html)
- [Publiczne instancje Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)

## Wgranie na GitHub Pages

Rozpakuj paczkę. Wgraj `index.html`, `version.json`, cały folder `assets`, folder `tests` i ten README do głównego katalogu repozytorium `gemciu83-lab/planer-tras-rowerowych`, zastępując istniejące pliki. Nie wgrywaj samego ZIP-a ani dodatkowego folderu nadrzędnego. Zatwierdź zmianę przyciskiem Commit changes i poczekaj na zakończenie wdrożenia Pages. Tytuł karty nowej wersji to „Planer tras rowerowych 3.11.0”.

## Weryfikacja

Testy lokalne (Node.js): `node tests/planner.test.cjs`. Obejmują dotychczasowe zachowanie trasowania i nowe preferencje, walidację postojów, kolejność godzin przyjazdu, zgodność starszych zapisów, projekcję miejsc na trasę, dodawanie przystanków oraz zachowanie czasów podczas przesuwania, odwracania i usuwania punktów. Zewnętrzne serwery mogą okresowo odmawiać lub opóźniać odpowiedzi; testy lokalne nie gwarantują ich dostępności.

