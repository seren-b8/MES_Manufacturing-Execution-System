import os
from PIL import Image
import win32print
import win32ui
from PIL import ImageWin

# เปิดเครื่องพิมพ์
printer_name = win32print.GetDefaultPrinter()
printer = win32print.OpenPrinter(printer_name)
printer_info = win32print.GetPrinter(printer, 2)

# โหลดภาพที่ต้องการพิมพ์
img = Image.open("cat.jpg")

# กำหนดการพิมพ์
hprinter = win32ui.CreateDC()
hprinter.CreatePrinterDC(printer_name)
hprinter.StartDoc("Print cat.jpg")
hprinter.StartPage()

# เปลี่ยนภาพเป็นโหมดที่เหมาะสมสำหรับการพิมพ์
dib = ImageWin.Dib(img)
dib.draw(hprinter.GetHandleOutput(), (0, 0, img.width, img.height))

# เสร็จสิ้นการพิมพ์
hprinter.EndPage()
hprinter.EndDoc()
hprinter.DeleteDC()

# def list_printer_status():
#     printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
#     print("สถานะปริ้นเตอร์ที่ติดตั้งในระบบ:")
#     for i, printer in enumerate(printers):
#         printer_name = printer[2]
#         printer_info = win32print.GetPrinter(win32print.OpenPrinter(printer_name), 2)
#         status = printer_info.get("Status", 0)

#         # ตรวจสอบสถานะ (0 = พร้อมใช้งาน, ค่าอื่นๆ แปลว่าไม่พร้อม)
#         if status == 0:
#             print(f"{i + 1}. {printer_name} - พร้อมใช้งาน")
#         else:
#             print(f"{i + 1}. {printer_name} - ไม่พร้อมใช้งาน (Status: {status})")
# Honeywell PC42t plus (203 dpi) (Copy 1)