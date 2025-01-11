"""
ระบบพิมพ์ฉลากสินค้าด้วย ZPL (Zebra Programming Language)
สามารถพิมพ์ข้อมูลสินค้า, QR Code และรูปภาพลงบนฉลาก
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import win32print
import base64
from io import BytesIO
from PIL import Image, ImageEnhance

app = Flask(__name__)
CORS(app)

# ======= ตัวแปรระดับโปรแกรม =======
PRINT_COUNTER = 1  # ตัวนับจำนวนการพิมพ์
DEFAULT_PRINTER = "Honeywell PC42t plus (203 dpi)"
MAX_IMAGE_SIZE = (180, 180)  # ขนาดสูงสุดของรูปภาพ (กว้าง, สูง)

# ======= ฟังก์ชันจัดการรูปภาพ =======
def convert_base64_to_zpl_image(image_base64):
    """แปลงรูปภาพ Base64 เป็นรูปแบบ ZPL
    
    Args:
        image_base64 (str): รูปภาพในรูปแบบ Base64
        
    Returns:
        str: คำสั่ง ZPL สำหรับแสดงรูปภาพ หรือ None ถ้าเกิดข้อผิดพลาด
    """
    try:
        # ลบ prefix ของ data URL ถ้ามี
        if image_base64.startswith("data:image"):
            image_base64 = image_base64.split(",")[1]
        
        # แปลงรูปภาพและปรับแต่ง
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        image = image.convert("L")  # แปลงเป็นภาพขาวดำ
        
        # เพิ่มความคมชัด
        contrast = ImageEnhance.Contrast(image)
        image = contrast.enhance(2)
        image = image.convert("1")  # แปลงเป็นภาพแบบ 1 bit
        
        # ปรับขนาดรูปภาพ
        image.thumbnail(MAX_IMAGE_SIZE, Image.LANCZOS)
        
        # แปลงเป็นรูปแบบ ZPL
        width, height = image.size
        bytes_per_row = (width + 7) // 8
        total_bytes = bytes_per_row * height
        
        # แปลงข้อมูลรูปภาพเป็น bytes
        zpl_image_data = bytearray()
        for y in range(height):
            byte = 0
            bit_count = 0
            for x in range(width):
                if image.getpixel((x, y)) == 0:  # พิกเซลสีดำ
                    byte |= (1 << (7 - bit_count))
                bit_count += 1
                if bit_count == 8:
                    zpl_image_data.append(byte)
                    byte = 0
                    bit_count = 0
            if bit_count > 0:
                zpl_image_data.append(byte)
        
        # แปลงเป็น hex string
        hex_data = ''.join(f"{b:02X}" for b in zpl_image_data)
        return f"^GFA,{total_bytes},{total_bytes},{bytes_per_row},{hex_data}\n"
        
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการแปลงรูปภาพ: {e}")
        return None

# ======= ฟังก์ชันสร้างฉลาก =======
def format_part_name(part_name):
    """จัดรูปแบบชื่อชิ้นส่วนให้แสดงผลบนฉลากได้เหมาะสม
    
    Args:
        part_name (str): ชื่อชิ้นส่วน
        
    Returns:
        list: รายการบรรทัดที่จัดรูปแบบแล้ว
    """
    if not part_name:
        return []
        
    words = part_name.split()
    lines = []
    current_line = ""
    space_count = 0
    
    for word in words:
        # ข้ามช่องว่างที่ 2 และ 3
        if space_count in [1, 2]:
            current_line += word + " "
        else:
            # ตรวจสอบความยาวบรรทัด
            if len(current_line + word) <= 10:
                current_line += word + " "
            else:
                lines.append(current_line.strip())
                current_line = word + " "
        space_count += 1
        
    if current_line:
        lines.append(current_line.strip())
    return lines

def generate_zpl_label(form_data, serial_number, counter, image_data=None):
    """สร้างคำสั่ง ZPL สำหรับพิมพ์ฉลาก
    
    Args:
        form_data (dict): ข้อมูลฟอร์มสำหรับฉลาก
        serial_number (str): หมายเลขซีเรียล
        counter (int): ตัวนับการพิมพ์
        image_data (str, optional): ข้อมูลรูปภาพในรูปแบบ ZPL
        
    Returns:
        str: คำสั่ง ZPL ทั้งหมด
    """
    # จัดการชื่อชิ้นส่วน
    part_name_lines = format_part_name(form_data['partName'])
    part_name_zpl = ""
    for i, line in enumerate(part_name_lines):
        y_position = 320 + (i * 45)
        part_name_zpl += f"^FO200,{y_position}^A0N,30,30^FD{line}^FS\n"
    
    # ตัดความยาวของวัสดุถ้าเกิน 14 ตัวอักษร
    material = form_data['mat'][:14] + "..." if len(form_data.get('mat', '')) > 14 else form_data.get('mat', '')
    
    # สร้างคำสั่ง ZPL
    zpl = f"""
^XA
^FO30,110^A0N,25,25^FDCustomer Name: {form_data['customerName']}^FS
^FO440,110^A0N,25,25^FDModel {form_data['model']}^FS
^FO740,110^A0N,25,25^FD{counter}^FS

^FO10,150^GB760,2,2^FS
^FO30,170^A0N,25,25^FDSupplier : ^FS
^FO150,170^A0N,25,25^FD{form_data['supplier']}^FS
^FO440,170^A0N,25,25^FDJob No.^FS
^FO590,170^A0N,25,25^FD{form_data['jobOrder']}^FS

{part_name_zpl}

^FO440,320^A0N,25,25^FDProducer^FS
^FO590,320^A0N,25,25^FD ^FS

^FO440,380^A0N,25,25^FDDate^FS
^FO590,380^A0N,25,25^FD ^FS

^FO30,440^A0N,25,25^FDPicture of Part^FS
^FO440,440^A0N,25,25^FDQuantity (Unit)^FS
^FO500,540^A0N,100,100^FD{form_data['quantityStd']}^FS

^FO225,480^BQN,2,7^FDQA,{form_data['matNo']}|{serial_number}^FS
"""

    # เพิ่มรูปภาพถ้ามี
    if image_data:
        zpl += f"^FO20,520\n{image_data}^FS\n"
    
    zpl += "^XZ"
    return zpl

# ======= ฟังก์ชันพิมพ์ =======
def print_zpl(zpl_data, printer_name=DEFAULT_PRINTER):
    """ส่งคำสั่ง ZPL ไปยังเครื่องพิมพ์
    
    Args:
        zpl_data (str): คำสั่ง ZPL
        printer_name (str): ชื่อเครื่องพิมพ์
    """
    try:
        printer = win32print.OpenPrinter(printer_name)
        job = win32print.StartDocPrinter(printer, 1, ("ZPL Label", None, "RAW"))
        win32print.StartPagePrinter(printer)
        win32print.WritePrinter(printer, zpl_data.encode('utf-8'))
        win32print.EndPagePrinter(printer)
        win32print.EndDocPrinter(printer)
        print(f"เริ่มพิมพ์ที่ {printer_name}")
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการพิมพ์: {e}")
    finally:
        if 'printer' in locals():
            win32print.ClosePrinter(printer)

# ======= Flask Route =======
@app.route('/printtest', methods=['POST'])
def print_label():
    """endpoint สำหรับรับคำสั่งพิมพ์ฉลาก"""
    global PRINT_COUNTER
    
    # ตรวจสอบข้อมูลที่ส่งมา
    data = request.json
    print("ได้รับข้อมูล POST:", data)
    
    if not data or not all(key in data for key in ['form_data', 'serial_number', 'state']):
        return jsonify({"error": "ข้อมูลไม่ครบถ้วน ต้องมี 'form_data', 'serial_number', และ 'state'"}), 400
        
    if data['state'] != "1":
        return jsonify({"error": "สถานะไม่ถูกต้องสำหรับการพิมพ์"}), 400
    
    # แปลงรูปภาพถ้ามี
    image_base64 = data.get('image')
    zpl_image = convert_base64_to_zpl_image(image_base64) if image_base64 else None
    
    # สร้างและพิมพ์ฉลาก
    zpl_data = generate_zpl_label(data['form_data'], data['serial_number'], PRINT_COUNTER, zpl_image)
    print_zpl(zpl_data)
    
    # อัพเดทตัวนับ
    PRINT_COUNTER = 1 if PRINT_COUNTER >= 100 else PRINT_COUNTER + 1
    
    return jsonify({
        "message": "ส่งงานพิมพ์เรียบร้อยแล้ว",
        "current_counter": PRINT_COUNTER
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)