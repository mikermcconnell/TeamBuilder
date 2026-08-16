"""Generate the Summer Outdoor 2026 exec review PDF."""

from __future__ import annotations

import argparse
import html
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


DEFAULT_JSON_PATH = Path("output/summer-2026/pass-4-nice75/summer-outdoor-2026-exec-review.json")
DEFAULT_OUTPUT_PATH = Path("output/pdf/summer-outdoor-2026-exec-review.pdf")
DEFAULT_PUBLIC_OUTPUT_PATH = Path("public/reports/summer-outdoor-2026-exec-review.pdf")


def clean_text(value: Any) -> str:
    text = "" if value is None else str(value)
    replacements = {
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2194": "<->",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text


def para(text: Any, style: ParagraphStyle) -> Paragraph:
    safe = html.escape(clean_text(text)).replace("\n", "<br/>")
    return Paragraph(safe, style)


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ExecTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#0f172a"),
            alignment=TA_LEFT,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "ExecSubtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569"),
            spaceAfter=8,
        ),
        "h1": ParagraphStyle(
            "ExecH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "ExecH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "ExecBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#334155"),
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "ExecSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.8,
            leading=8.2,
            textColor=colors.HexColor("#334155"),
        ),
        "small_bold": ParagraphStyle(
            "ExecSmallBold",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.8,
            leading=8.2,
            textColor=colors.HexColor("#0f172a"),
        ),
        "snapshot_team": ParagraphStyle(
            "SnapshotTeam",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=8,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=1.5,
        ),
        "snapshot_meta": ParagraphStyle(
            "SnapshotMeta",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=5.6,
            leading=6.4,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=2,
        ),
        "snapshot_player": ParagraphStyle(
            "SnapshotPlayer",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=5.5,
            leading=6.4,
            textColor=colors.HexColor("#334155"),
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.8,
            leading=8,
            textColor=colors.HexColor("#64748b"),
            alignment=TA_CENTER,
        ),
        "metric_value": ParagraphStyle(
            "MetricValue",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            alignment=TA_CENTER,
        ),
    }


def bullet_list(items: list[str], style: ParagraphStyle) -> list[Paragraph]:
    return [para(f"- {item}", style) for item in items]


def status_label(value: str) -> str:
    if value == "new":
        return "New"
    if value == "returning":
        return "Returning"
    return "Unknown"


def age_label(value: str) -> str:
    if value == "young":
        return "Young"
    if value == "wise":
        return "Wise"
    if value == "standard":
        return "Standard"
    return "Unknown"


def leader_label(player: dict[str, Any]) -> str:
    leaders = player.get("leaders", [])
    return ", ".join(leaders) if leaders else ""


def leader_codes(player: dict[str, Any]) -> list[str]:
    codes = []
    for leader in player.get("leaders", []):
        if "Female" in leader:
            codes.append("FL")
        elif "A" in leader:
            codes.append("ML-A")
        elif "B" in leader:
            codes.append("ML-B")
        else:
            codes.append("L")
    return codes


def player_codes(player: dict[str, Any]) -> str:
    codes = [f'S{float(player["skill"]):.1f}']
    if player.get("handler"):
        codes.append("H")
    codes.extend(leader_codes(player))
    if player.get("newReturning") == "new":
        codes.append("N")
    elif player.get("newReturning") == "returning":
        codes.append("R")
    return " ".join(codes)


def make_metric_table(report: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> Table:
    roster = report["roster"]
    metrics = [
        ("Players", f'{roster["totalPlayers"]}', f'{roster["male"]}M / {roster["female"]}F / {roster["other"]}O'),
        ("Teams", report["source"]["teamCount"], "per option"),
        ("Nice requests", roster["mutualNicePairs"], "mutual only"),
        ("Handlers", roster["handlers"], "spread by team"),
        ("Leaders", roster["femaleLeaders"] + roster["maleLeaderA"] + roster["maleLeaderB"], "female + male"),
    ]
    cell_width = width / len(metrics)
    cells = []
    for label, value, detail in metrics:
        cells.append(
            Table(
                [
                    [para(label, styles["metric_label"])],
                    [para(value, styles["metric_value"])],
                    [para(detail, styles["small"])],
                ],
                colWidths=[cell_width - 10],
            )
        )
    table = Table([cells], colWidths=[cell_width] * len(metrics), hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def make_table(rows: list[list[Any]], widths: list[float], styles: dict[str, ParagraphStyle], header: bool = True) -> Table:
    table_rows = []
    for row_index, row in enumerate(rows):
        row_style = styles["small_bold"] if row_index == 0 and header else styles["small"]
        table_rows.append([para(cell, row_style) for cell in row])
    table = Table(table_rows, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0") if header else colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def variation_comparison(report: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> Table:
    rows = [["Option", "Nice requests honoured", "Gender balance", "Skill", "Handlers", "Female leaders", "Male leaders"]]
    for variation in report["variations"]:
        summary = variation["summary"]
        rows.append(
            [
                variation["name"] + (" (recommended)" if variation.get("recommended") else ""),
                f'{summary["niceHonored"]}/{summary["niceTotal"]} ({round(summary["niceRate"] * 100)}%)',
                f'{summary["maleSpread"]}M / {summary["femaleSpread"]}F spread',
                f'{summary["skillSpread"]:.2f}',
                summary["handlerSpread"],
                f'{summary["femaleLeaderTeams"]}/8 teams',
                f'{summary["maleLeaderCoveredTeams"]}/8 teams',
            ]
        )
    return make_table(rows, [width * part for part in [0.16, 0.19, 0.15, 0.1, 0.1, 0.15, 0.15]], styles)


def snapshot_team_cell(team: dict[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    cell: list[Any] = [
        para(team["name"], styles["snapshot_team"]),
        para(
            f'{team["size"]} players | {team["male"]}M/{team["female"]}F | Avg {team["averageSkill"]:.2f} | {team["handlers"]}H | {len(team["niceRequestsHonored"])} nice',
            styles["snapshot_meta"],
        ),
    ]
    for player in team["roster"]:
        cell.append(para(f'{player["name"]}  {player_codes(player)}', styles["snapshot_player"]))
    return cell


def add_snapshot_page(story: list[Any], variation: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> None:
    summary = variation["summary"]
    title = f'{variation["name"]} team snapshot' + (" - recommended" if variation.get("recommended") else "")
    story.append(para(title, styles["h1"]))
    story.append(
        para(
            f'{summary["niceHonored"]}/{summary["niceTotal"]} nice requests honoured | '
            f'{summary["femaleLeaderTeams"]}/8 teams have female leaders | '
            f'{summary["maleLeaderCoveredTeams"]}/8 teams have male leaders | '
            "H=handler, FL=female leader, ML-A/ML-B=male leader, N/R=new/returning",
            styles["subtitle"],
        )
    )
    teams = variation["teams"]
    grid = [
        [snapshot_team_cell(team, styles) for team in teams[:4]],
        [snapshot_team_cell(team, styles) for team in teams[4:8]],
    ]
    table = Table(grid, colWidths=[width / 4] * 4, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)


def player_detail_rows(variation: dict[str, Any]) -> list[list[Any]]:
    rows = [["Team", "Player", "Gender", "Skill", "Handler", "Leader", "Status", "Age"]]
    for team in variation["teams"]:
        for player in team["roster"]:
            rows.append(
                [
                    team["name"],
                    player["name"],
                    player["gender"],
                    f'{float(player["skill"]):.1f}',
                    "Yes" if player.get("handler") else "No",
                    leader_label(player),
                    status_label(player.get("newReturning", "unknown")),
                    age_label(player.get("ageBand", "unknown")),
                ]
            )
    return rows


def add_player_detail_section(story: list[Any], variation: dict[str, Any], styles: dict[str, ParagraphStyle], width: float) -> None:
    title = f'{variation["name"]} player rows'
    story.append(para(title, styles["h1"]))
    story.append(
        make_table(
            player_detail_rows(variation),
            [width * part for part in [0.08, 0.23, 0.06, 0.06, 0.07, 0.19, 0.12, 0.09]],
            styles,
        )
    )


def footer(canvas: Any, doc: SimpleDocTemplate) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(doc.leftMargin, 0.28 * inch, "Summer Outdoor 2026 Team Options")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 0.28 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf(report: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    page_size = landscape(LETTER)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=page_size,
        leftMargin=0.42 * inch,
        rightMargin=0.42 * inch,
        topMargin=0.42 * inch,
        bottomMargin=0.52 * inch,
        title=f'{report["seasonName"]} Team Options',
        author="TeamBuilder",
    )
    width = doc.width
    styles = make_styles()
    story: list[Any] = []

    generated = report.get("generatedAt", "")
    try:
        generated_label = datetime.fromisoformat(generated.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        generated_label = clean_text(generated)

    story.append(para(f'{report["seasonName"]} Team Options', styles["title"]))
    story.append(para(f"Generated: {generated_label}", styles["subtitle"]))
    story.append(para("Executive summary", styles["h1"]))
    story.append(make_metric_table(report, styles, width))
    story.append(Spacer(1, 0.1 * inch))
    story.append(para(f'Recommended option: {report["recommendation"]["title"]}', styles["h2"]))
    story.extend(bullet_list(report["recommendation"]["rationale"], styles["body"]))
    story.append(para("Summary table", styles["h1"]))
    story.append(variation_comparison(report, styles, width))

    for variation in report["variations"]:
        story.append(PageBreak())
        add_snapshot_page(story, variation, styles, width)

    for variation in report["variations"]:
        story.append(PageBreak())
        add_player_detail_section(story, variation, styles, width)

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the Summer Outdoor 2026 team options PDF.")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON_PATH, help="Path to generated exec review JSON.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH, help="PDF output path.")
    parser.add_argument("--public-output", type=Path, default=DEFAULT_PUBLIC_OUTPUT_PATH, help="Optional public PDF copy for the website.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with args.json.open("r", encoding="utf-8") as file:
        report = json.load(file)

    build_pdf(report, args.output)
    args.public_output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.output, args.public_output)
    print(f"PDF written: {args.output}")
    print(f"Website PDF copy: {args.public_output}")


if __name__ == "__main__":
    main()
