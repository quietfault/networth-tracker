# Generates import-template.xlsx: the import contract with invented data.
# Run: python docs/import/make-template.py
#      powershell -File docs/import/save-through-excel.ps1   (fills formula values)
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "import-template.xlsx")

F = "Arial"
BLUE = Font(name=F, color="0000FF")
BLACK = Font(name=F)
BOLD = Font(name=F, bold=True)
GREY = Font(name=F, color="808080", italic=True, size=9)
TITLE = Font(name=F, bold=True, size=13)
HDR_FILL = PatternFill("solid", fgColor="E7E6E6")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
thin = Side(style="thin", color="BFBFBF")
BOX = Border(bottom=thin)

LAST_COL = "DZ"  # place columns F..DZ — room for ~120 places, closed ones included

places = [
    # name, category, currency, form
    ("Сбер", "Банки", "RUB", "безнал"),
    ("Тинькофф", "Банки", "RUB", "безнал"),
    ("Тинькофф USD", "Банки", "USD", "безнал"),
    ("Альфа", "Банки", "RUB", "безнал"),
    ("Налик ₽", "Наличные", "RUB", "нал"),
    ("Налик $", "Наличные", "USD", "нал"),
    ("Налик €", "Наличные", "EUR", "нал"),
    ("Крипта", "Крипта", "BTC", "безнал"),
    ("Машиноместо", "Активы", "RUB", "—"),
    ("Кроссовки", "Сток", "RUB", "—"),
]

# Invented example rows. Альфа is closed after March to show a place that went to zero.
rows = [
    ("2025-01-31", 101.0, 1.0400, 102000, [420000, 85000, 3000, 60000, 50000, 1500, 400, 0.250, 1500000, 240000]),
    ("2025-02-28", 98.5, 1.0355, 84000, [450000, 90000, 3200, 40000, 45000, 1500, 400, 0.260, 1500000, 210000]),
    ("2025-03-31", 86.0, 1.0810, 82500, [380000, 70000, 3500, 0, 60000, 1800, 400, 0.275, 1500000, 180000]),
    ("2025-04-30", 84.0, 1.1350, 94000, [410000, 75000, 3500, 0, 55000, 1800, 300, 0.275, 1500000, 150000]),
    ("2025-05-31", 80.5, 1.1280, 104000, [430000, 80000, 3600, 0, 52000, 2000, 300, 0.280, 1500000, 120000]),
    ("2025-06-30", 79.0, 1.1720, 107000, [455000, 82000, 3600, 0, 50000, 2000, 300, 0.290, 1500000, 90000]),
]

wb = Workbook()

# --- Legend -------------------------------------------------------------
lg = wb.active
lg.title = "Как заполнять"
lines = [
    ("Шаблон импорта истории в «Срез»", TITLE),
    ("Все числа в этом файле выдуманные — это образец формата, а не данные.", GREY),
    ("", None),
    ("Два листа — это договор с приложением. Приложение читает только их.", BOLD),
    ("", None),
    ("«Места» — справочник: одна строка на каждое место, где лежат или лежали деньги.", BLACK),
    ("   Место — точное имя, как в заголовке колонки на листе «Срезы».", BLACK),
    ("   Категория — любой текст. Новая категория появится в приложении сама.", BLACK),
    ("   Валюта — RUB, USD, EUR или BTC. USDT записывается как USD (один курс).", BLACK),
    ("   Форма — нал, безнал или «—» для активов и стока.", BLACK),
    ("", None),
    ("«Срезы» — одна строка на дату, как главная вкладка.", BLACK),
    ("   Дата — дата среза. Один срез в месяц: две строки в одном месяце приложение отклонит.", BLACK),
    ("   USDT/RUB — курс USDT на P2P. По нему же пересчитываются USD.", BLACK),
    ("   EUR/USD — курс евро к доллару (ЕЦБ). Евро в рубли идёт через доллар: EUR/USD × USDT/RUB.", BLACK),
    ("   BTC/USD — цена биткоина в долларах.", BLACK),
    ("   Итог ₽ — итог по вашему Excel. Приложение посчитает свой и покажет строки, где они разошлись.", BLACK),
    ("В «Итог ₽» — число из вашей главной вкладки (Специальная вставка → Значения) или ссылка на её итог. Формулу шаблона не оставляйте: иначе приложение сверит само себя и любая ошибка переноса покажет «сошлось».", BOLD),
    ("   Дальше — колонки мест (до ~120, закрытые тоже считаются), в валюте места. Новое место — новая колонка справа", BLACK),
    ("   плюс строка на листе «Места». Место закрылось — ставьте 0, колонку не удаляйте.", BLACK),
    ("", None),
    ("Строка 2 на «Срезах» серая — она считается сама и показывает валюту колонки.", BLACK),
    ("Знак «?» в ней значит, что имени колонки нет в «Местах».", BLACK),
    ("", None),
    ("Пересчёт в рубли:", BOLD),
    ("   RUB × 1 · USD × USDT/RUB · EUR × EUR/USD × USDT/RUB · BTC × BTC/USD × USDT/RUB", BLACK),
    ("", None),
    ("Цвета: синий текст на жёлтом — то, что вы вводите; чёрный — формулы.", BLACK),
]
for i, (text, font) in enumerate(lines, start=1):
    c = lg.cell(row=i, column=1, value=text or None)
    if font:
        c.font = font
lg.column_dimensions["A"].width = 110

# --- Places -------------------------------------------------------------
pl = wb.create_sheet("Места")
heads = ["Место", "Категория", "Валюта", "Форма"]
for j, h in enumerate(heads, start=1):
    c = pl.cell(row=1, column=j, value=h)
    c.font, c.fill, c.border = BOLD, HDR_FILL, BOX
for i, rec in enumerate(places, start=2):
    for j, v in enumerate(rec, start=1):
        c = pl.cell(row=i, column=j, value=v)
        c.font, c.fill = BLUE, INPUT_FILL
for col, w in zip("ABCD", (24, 18, 10, 10)):
    pl.column_dimensions[col].width = w
pl.freeze_panes = "A2"

dv_cur = DataValidation(type="list", formula1='"RUB,USD,EUR,BTC"', allow_blank=True)
dv_form = DataValidation(type="list", formula1='"нал,безнал,—"', allow_blank=True)
pl.add_data_validation(dv_cur)
pl.add_data_validation(dv_form)
dv_cur.add("C2:C200")
dv_form.add("D2:D200")

# --- Snapshots ----------------------------------------------------------
sn = wb.create_sheet("Срезы")
sn["A1"] = "Срезы — одна строка на дату"
sn["A1"].font = TITLE

sn["E2"] = "валюта →"
sn["E2"].font = GREY
sn["E2"].alignment = Alignment(horizontal="right")
last_idx = sn[f"{LAST_COL}1"].column
for col in range(6, last_idx + 1):
    L = get_column_letter(col)
    c = sn.cell(row=2, column=col,
                value=f'=IF({L}$3="","",IFERROR(INDEX(Места!$C:$C,MATCH({L}$3,Места!$A:$A,0)),"?"))')
    c.font = GREY
    c.alignment = Alignment(horizontal="center")

headers = ["Дата", "USDT/RUB", "EUR/USD", "BTC/USD", "Итог ₽"] + [p[0] for p in places]
for j, h in enumerate(headers, start=1):
    c = sn.cell(row=3, column=j, value=h)
    c.font, c.fill, c.border = BOLD, HDR_FILL, BOX
    c.alignment = Alignment(horizontal="center", wrap_text=True)
sn["E3"].comment = Comment(
    "В шаблоне здесь формула для образца. В вашем файле нужно число из вашей главной вкладки "
    "(значения или ссылка на её итог), а не эта формула: иначе приложение сверит само себя.", "quietfault")

rng = f"$F$2:${LAST_COL}$2"
for i, (d, usdt, eur, btc, amounts) in enumerate(rows, start=4):
    from datetime import date
    y, m, dd = map(int, d.split("-"))
    vals = [date(y, m, dd), usdt, eur, btc]
    for j, v in enumerate(vals, start=1):
        c = sn.cell(row=i, column=j, value=v)
        c.font, c.fill = BLUE, INPUT_FILL
    sn.cell(row=i, column=1).number_format = "YYYY-MM-DD"
    sn.cell(row=i, column=2).number_format = "#,##0.00"
    sn.cell(row=i, column=3).number_format = "0.0000"
    sn.cell(row=i, column=4).number_format = "#,##0"
    total = (f'=IF(COUNTIF({rng},"?")>0,"нет в «Места»",'
             f'SUMPRODUCT($F{i}:${LAST_COL}{i}*(({rng}="RUB")+({rng}="USD")*$B{i}'
             f'+({rng}="EUR")*$C{i}*$B{i}+({rng}="BTC")*$D{i}*$B{i})))')
    c = sn.cell(row=i, column=5, value=total)
    c.font = BLACK
    c.number_format = '#,##0" ₽"'
    for k, (amt, p) in enumerate(zip(amounts, places)):
        c = sn.cell(row=i, column=6 + k, value=amt)
        c.font, c.fill = BLUE, INPUT_FILL
        c.number_format = "0.0000" if p[2] == "BTC" else "#,##0"

sn.column_dimensions["A"].width = 12
for col in "BCD":
    sn.column_dimensions[col].width = 11
sn.column_dimensions["E"].width = 16
for k in range(len(places)):
    sn.column_dimensions[get_column_letter(6 + k)].width = 13
sn.row_dimensions[3].height = 30
sn.freeze_panes = "F4"

wb.active = 0
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("saved", OUT)
