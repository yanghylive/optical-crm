# -*- coding: utf-8 -*-
"""生成眼镜店配镜记录 CRM 导入模板"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from datetime import date

OUT = r"C:\Users\ThinkPad\Documents\optical-crm\templates\配镜记录_导入模板.xlsx"

wb = openpyxl.Workbook()

# ---------- Sheet 1: 配镜记录 ----------
ws = wb.active
ws.title = "配镜记录"

headers = [
    "备注", "日期", "姓名", "性别", "年龄", "电话", "学校", "来源", "来源明细",
    "金额", "医生", "销售", "制作", "公司", "分类方式", "框/产品", "型号", "片",
    "度数R", "度数L", "瞳距", "RPD", "LPD", "瞳高R", "瞳高L",
]

header_fill = PatternFill("solid", fgColor="1F4E78")
header_font = Font(color="FFFFFF", bold=True, size=11)
thin = Side(style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

for col, h in enumerate(headers, 1):
    c = ws.cell(row=1, column=col, value=h)
    c.fill = header_fill
    c.font = header_font
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = border

widths = [18, 11, 10, 7, 7, 14, 16, 12, 14, 10, 10, 10, 10, 16, 12, 14, 14, 14, 12, 12, 8, 8, 8, 8, 8]
for i, w in enumerate(widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.row_dimensions[1].height = 30

# 示例数据（虚构）
samples = [
    ["老客户复购，旧镜架调整", date(2026, 11, 2), "张晓雨", "女", 28, "13800000001", "市第一中学", "老客户转介绍", "王老师推荐", 1280.00, "李医生", "陈销售", "周师傅", "明亮光学", "框架眼镜", "暴龙", "BJ7132", "1.60 非球面防蓝光", "-3.50/-0.75×180", "-3.25/-0.50×175", 62.5, 31.5, 31.0, 20.5, 20.0],
    ["学生首次配镜", date(2026, 11, 3), "李浩然", "男", 15, "13800000002", "实验中学", "学校筛查", "视力筛查异常", 680.00, "王医生", "陈销售", "周师傅", "明亮光学", "框架眼镜", "陌森", "MJ3021", "1.56 单光", "-2.00", "-1.75/-0.50×180", 60.0, 30.0, 30.0, 18.5, 18.5],
    ["隐形眼镜年抛", date(2026, 11, 5), "王倩", "女", 32, "13800000003", "", "抖音", "直播间团购", 399.00, "", "刘销售", "", "康视达", "隐形眼镜", "博士伦", "清朗年抛", "隐形眼镜", "-4.00", "-4.25", 63.0, 31.5, 31.5, "", ""],
]
for r, row in enumerate(samples, 2):
    for c, val in enumerate(row, 1):
        cell = ws.cell(row=r, column=c, value=val)
        cell.border = border
        cell.alignment = Alignment(vertical="center", wrap_text=(c in (1, 16, 18)))
        if c == 2:
            cell.number_format = "yyyy-mm-dd"
        if c == 10:
            cell.number_format = "¥#,##0.00"

# 数据验证
dv_gender = DataValidation(type="list", formula1='"男,女"', allow_blank=True)
dv_source = DataValidation(type="list", formula1='"门店自然客,老客户转介绍,抖音,美团/大众点评,小红书,学校筛查,医院转诊,其他"', allow_blank=True)
dv_category = DataValidation(type="list", formula1='"框架眼镜,隐形眼镜,太阳镜,功能镜片,其他"', allow_blank=True)
dv_age = DataValidation(type="whole", operator="between", formula1="0", formula2="120", allow_blank=True)
dv_amount = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
for dv in (dv_gender, dv_source, dv_category, dv_age, dv_amount):
    ws.add_data_validation(dv)
dv_gender.add("D2:D5000")
dv_source.add("H2:H5000")
dv_category.add("O2:O5000")
dv_age.add("E2:E5000")
dv_amount.add("J2:J5000")

ws.freeze_panes = "A2"
ws.auto_filter.ref = "A1:Y1"

# ---------- Sheet 2: 填写说明 ----------
ws2 = wb.create_sheet("填写说明")
ws2.column_dimensions["A"].width = 16
ws2.column_dimensions["B"].width = 12
ws2.column_dimensions["C"].width = 60
ws2.column_dimensions["D"].width = 30

ws2["A1"] = "字段"
ws2["B1"] = "类型"
ws2["C1"] = "填写说明"
ws2["D1"] = "示例"
for c in ws2[1]:
    c.fill = header_fill
    c.font = header_font
    c.alignment = Alignment(horizontal="center", vertical="center")
    c.border = border

notes = [
    ("备注", "文本", "整单备注，可记录售后、特殊要求、复购情况等", "老客户复购，旧镜架调整"),
    ("日期", "日期", "开单/配镜日期，格式 YYYY-MM-DD", "2026-11-02"),
    ("姓名", "文本", "客户姓名，必填；系统按姓名+电话识别客户", "张晓雨"),
    ("性别", "下拉", "男 / 女", "女"),
    ("年龄", "整数", "0-120", "28"),
    ("电话", "文本", "手机号，建议必填，用于客户去重和回访", "13800000001"),
    ("学校", "文本", "学生客户填写学校，成人可留空", "市第一中学"),
    ("来源", "下拉", "客户来源渠道，用于统计获客效果", "老客户转介绍"),
    ("来源明细", "文本", "来源的补充说明，如推荐人、活动名称、团购单号", "王老师推荐"),
    ("金额", "金额", "本单实收金额（元），不要填¥符号", "1280.00"),
    ("医生", "文本", "验光医生/视光师姓名", "李医生"),
    ("销售", "文本", "接待销售姓名", "陈销售"),
    ("制作", "文本", "加工制作人员姓名，隐形眼镜可留空", "周师傅"),
    ("公司", "文本", "镜片/镜架供货公司或品牌方", "明亮光学"),
    ("分类方式", "下拉", "框架眼镜 / 隐形眼镜 / 太阳镜 / 功能镜片 / 其他", "框架眼镜"),
    ("框/产品", "文本", "镜架品牌或产品大类", "暴龙"),
    ("型号", "文本", "镜架/镜片/隐形眼镜的具体型号", "BJ7132"),
    ("片", "文本", "镜片类型、折射率、膜层等", "1.60 非球面防蓝光"),
    ("度数R", "文本", "右眼处方，建议按 球镜/柱镜×轴位 填写", "-3.50/-0.75×180"),
    ("度数L", "文本", "左眼处方，建议按 球镜/柱镜×轴位 填写", "-3.25/-0.50×175"),
    ("瞳距", "数字", "双眼瞳距 PD，单位 mm", "62.5"),
    ("RPD", "数字", "右眼单眼瞳距，单位 mm", "31.5"),
    ("LPD", "数字", "左眼单眼瞳距，单位 mm", "31.0"),
    ("瞳高R", "数字", "右眼瞳高，单位 mm，渐进片建议必填；隐形眼镜可留空", "20.5"),
    ("瞳高L", "数字", "左眼瞳高，单位 mm，渐进片建议必填；隐形眼镜可留空", "20.0"),
]
for r, row in enumerate(notes, 2):
    for c, val in enumerate(row, 1):
        cell = ws2.cell(row=r, column=c, value=val)
        cell.border = border
        cell.alignment = Alignment(vertical="top", wrap_text=True)

ws2.freeze_panes = "A2"

# ---------- Sheet 3: 使用说明 ----------
ws3 = wb.create_sheet("使用说明")
ws3.column_dimensions["A"].width = 100
lines = [
    "眼镜店配镜记录 · CRM 导入模板",
    "",
    "1. 本模板按原 Excel 的 23 列 + 瞳高R/瞳高L 共 25 列设计，前 23 列顺序与原表一致，可直接沿用它继续录单。",
    "2. 灰色/白色数据行可删除，只保留表头，再从第 2 行开始录入真实数据。",
    "3. 日期列请使用 YYYY-MM-DD 格式；金额列只填数字。",
    "4. 性别、来源、分类方式已设置下拉选项，请尽量使用下拉值，便于后续统计。",
    "5. 度数R/度数L 建议统一写成「球镜/柱镜×轴位」，例如 -3.50/-0.75×180；只有球镜时写 -2.00。",
    "6. 导入 CRM 前，请先在系统中建立「客户」和「配镜记录」两张表，再按字段一一对应导入。",
    "7. 姓名+电话是客户去重键；同一客户多次配镜会产生多条配镜记录，客户档案只保留一份。",
    "",
    "建议的 CRM 页面：",
    "· 工作台：今日营业额、本月营业额、客户数、客单价、来源分布、销售排行",
    "· 客户管理：客户档案 + 历史配镜记录 + 回访提醒",
    "· 配镜记录：按日期/来源/销售/分类筛选，支持 Excel 导入导出",
    "· 基础数据：员工（医生/销售/制作）、商品/品牌、来源渠道",
]
for r, line in enumerate(lines, 1):
    cell = ws3.cell(row=r, column=1, value=line)
    if r == 1:
        cell.font = Font(bold=True, size=16, color="1F4E78")
    elif line.startswith("建议"):
        cell.font = Font(bold=True, size=11, color="1F4E78")

wb.save(OUT)
print("saved:", OUT)
