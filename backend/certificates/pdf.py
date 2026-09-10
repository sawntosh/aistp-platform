"""
Server-rendered certificate PDF (A4 landscape) built with fpdf2 core fonts
-- no external assets or system libraries.
"""
from fpdf import FPDF

# Palette
NAVY = (27, 42, 74)
NAVY_SOFT = (42, 60, 100)
GOLD = (201, 162, 74)
GOLD_SOFT = (222, 200, 150)
CREAM = (251, 249, 244)
INK = (35, 47, 74)
GREY = (120, 128, 145)
WHITE = (255, 255, 255)

PAGE_W, PAGE_H = 297.0, 210.0
CENTER_X = PAGE_W / 2


def _ascii(value):
    """Core fonts are latin-1 only; keep unknown glyphs from crashing."""
    return str(value).encode("latin-1", "replace").decode("latin-1")


def _text(pdf, y, text, *, font="Helvetica", style="", size=11, color=INK, spacing=0.0):
    pdf.set_font(font, style, size)
    pdf.set_text_color(*color)
    if spacing:
        pdf.set_char_spacing(spacing)
    pdf.set_xy(0, y)
    pdf.cell(PAGE_W, size / 2, _ascii(text), align="C")
    if spacing:
        pdf.set_char_spacing(0.0)


def _corner_triangles(pdf):
    pdf.set_fill_color(*NAVY)
    size = 34
    pdf.polygon([(8, 8), (8 + size, 8), (8, 8 + size)], style="F")
    pdf.polygon([(PAGE_W - 8, 8), (PAGE_W - 8 - size, 8), (PAGE_W - 8, 8 + size)], style="F")
    pdf.polygon([(8, PAGE_H - 8), (8 + size, PAGE_H - 8), (8, PAGE_H - 8 - size)], style="F")
    pdf.polygon(
        [(PAGE_W - 8, PAGE_H - 8), (PAGE_W - 8 - size, PAGE_H - 8), (PAGE_W - 8, PAGE_H - 8 - size)],
        style="F",
    )
    pdf.set_fill_color(*GOLD)
    inner = 20
    pdf.polygon([(10, 10), (10 + inner, 10), (10, 10 + inner)], style="F")
    pdf.polygon([(PAGE_W - 10, 10), (PAGE_W - 10 - inner, 10), (PAGE_W - 10, 10 + inner)], style="F")
    pdf.polygon([(10, PAGE_H - 10), (10 + inner, PAGE_H - 10), (10, PAGE_H - 10 - inner)], style="F")
    pdf.polygon(
        [(PAGE_W - 10, PAGE_H - 10), (PAGE_W - 10 - inner, PAGE_H - 10), (PAGE_W - 10, PAGE_H - 10 - inner)],
        style="F",
    )


def _logo(pdf, x, y):
    """A small AISTP mountain mark next to the wordmark."""
    pdf.set_fill_color(*NAVY)
    pdf.polygon([(x, y + 11), (x + 5.5, y), (x + 11, y + 11)], style="F")
    pdf.set_fill_color(*GOLD)
    pdf.polygon([(x + 6.5, y + 11), (x + 9, y + 5.5), (x + 11.5, y + 11)], style="F")


def _seal(pdf, cx, cy):
    r = 15.0
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(1.3)
    pdf.ellipse(cx - r - 1.6, cy - r - 1.6, (r + 1.6) * 2, (r + 1.6) * 2, style="D")
    pdf.set_fill_color(*NAVY)
    pdf.ellipse(cx - r, cy - r, r * 2, r * 2, style="F")
    pdf.set_draw_color(*GOLD_SOFT)
    pdf.set_line_width(0.4)
    pdf.ellipse(cx - r + 2.4, cy - r + 2.4, (r - 2.4) * 2, (r - 2.4) * 2, style="D")

    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(cx - 20, cy - 5.5)
    pdf.cell(40, 5, "AISTP", align="C")
    pdf.set_text_color(*GOLD_SOFT)
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_char_spacing(0.6)
    pdf.set_xy(cx - 20, cy + 1.2)
    pdf.cell(40, 4, "CERTIFIED", align="C")
    pdf.set_char_spacing(0.0)


def render_certificate_pdf(certificate):
    issued = certificate.issued_at.strftime("%d %b %Y").upper()

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()

    # Background + frame
    pdf.set_fill_color(*CREAM)
    pdf.rect(0, 0, PAGE_W, PAGE_H, style="F")
    _corner_triangles(pdf)
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(1.4)
    pdf.rect(8, 8, PAGE_W - 16, PAGE_H - 16, style="D")
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.5)
    pdf.rect(11, 11, PAGE_W - 22, PAGE_H - 22, style="D")

    # Header
    _logo(pdf, 24, 17)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*NAVY)
    pdf.set_xy(37, 17)
    pdf.cell(60, 11, "AISTP")
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(*GREY)
    pdf.set_char_spacing(0.5)
    pdf.set_xy(24, 29)
    pdf.cell(90, 4, "AI-ASSISTED SOFTWARE TESTING PLATFORM")
    pdf.set_char_spacing(0.0)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(*NAVY)
    pdf.set_char_spacing(0.8)
    pdf.set_xy(PAGE_W - 110, 20)
    pdf.cell(87, 5, "LEARN   /   PRACTICE   /   CERTIFY   /   GROW", align="R")
    pdf.set_char_spacing(0.0)

    # Title
    _text(pdf, 46, "CERTIFICATE OF ACHIEVEMENT", font="Times", style="B", size=30, color=NAVY)

    # Divider with a diamond
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.5)
    pdf.line(112, 63, 140, 63)
    pdf.line(157, 63, 185, 63)
    pdf.set_fill_color(*GOLD)
    pdf.polygon([(148.5, 60.5), (151, 63), (148.5, 65.5), (146, 63)], style="F")

    _text(pdf, 73, "This certificate is proudly presented to", size=11, color=NAVY_SOFT)
    _text(pdf, 84, certificate.recipient_name, font="Times", style="B", size=30, color=NAVY)
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.4)
    pdf.line(88, 101, PAGE_W - 88, 101)

    _text(pdf, 108, "for successfully completing", size=10, color=NAVY_SOFT)
    _text(pdf, 117, certificate.exam_label, style="B", size=17, color=NAVY)

    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*NAVY_SOFT)
    pdf.set_xy(CENTER_X - 95, 129)
    pdf.multi_cell(
        190,
        5,
        _ascii(
            "and demonstrating knowledge and competency in "
            "software testing principles, techniques and practices."
        ),
        align="C",
    )

    # Three-field row
    row_y = 150
    pdf.set_draw_color(*GOLD_SOFT)
    pdf.set_line_width(0.3)
    pdf.line(116, 147, 116, 162)
    pdf.line(181, 147, 181, 162)
    fields = [
        (72, "ISSUED ON", issued),
        (CENTER_X, "SCORE", f"{certificate.score_percent}%"),
        (225, "CERTIFICATE ID", certificate.certificate_id),
    ]
    for cx, label, value in fields:
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*GREY)
        pdf.set_char_spacing(0.6)
        pdf.set_xy(cx - 35, row_y)
        pdf.cell(70, 4, label, align="C")
        pdf.set_char_spacing(0.0)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(*NAVY)
        pdf.set_xy(cx - 40, row_y + 6)
        pdf.cell(80, 5, _ascii(value), align="C")

    # Signature (left)
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.3)
    pdf.line(34, 184, 88, 184)
    pdf.set_font("Times", "BI", 15)
    pdf.set_text_color(*NAVY)
    pdf.set_xy(38, 174)
    pdf.cell(46, 8, "AISTP", align="C")
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_xy(34, 185)
    pdf.cell(54, 4, "Authorized Signature", align="C")
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*GREY)
    pdf.set_xy(34, 189)
    pdf.cell(54, 4, "AISTP Platform", align="C")

    # Seal (center)
    _seal(pdf, CENTER_X, 182)

    # Credential id block (right)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*GREY)
    pdf.set_char_spacing(0.6)
    pdf.set_xy(214, 175)
    pdf.cell(59, 4, "AISTP CREDENTIAL", align="R")
    pdf.set_char_spacing(0.0)
    pdf.set_draw_color(*GOLD_SOFT)
    pdf.set_line_width(0.3)
    pdf.line(214, 181, 273, 181)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.set_xy(214, 183)
    pdf.cell(59, 5, _ascii(certificate.certificate_id), align="R")
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(*GREY)
    pdf.set_xy(214, 189)
    pdf.cell(59, 4, f"Issued {issued} by AISTP", align="R")

    # Footer
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*GREY)
    pdf.set_char_spacing(0.8)
    pdf.set_xy(0, 197)
    pdf.cell(PAGE_W, 4, "BETTER TESTERS   /   HIGHER QUALITY SOFTWARE", align="C")
    pdf.set_char_spacing(0.0)

    out = pdf.output()
    return bytes(out) if not isinstance(out, (bytes, bytearray)) else bytes(out)
