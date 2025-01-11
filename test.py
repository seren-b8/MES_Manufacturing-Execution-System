import win32print
import time

def print_raw_data(printer_name, data):
    """พิมพ์ข้อมูลโดยตรงไปยังเครื่องพิมพ์"""
    try:
        handle = win32print.OpenPrinter(printer_name)
        if not handle:
            return False

        try:
            job = win32print.StartDocPrinter(handle, 1, ("Raw EPL Document", None, "RAW"))
            try:
                win32print.StartPagePrinter(handle)
                bytes_written = win32print.WritePrinter(handle, data)
                print(f"Bytes written: {bytes_written}")
                win32print.EndPagePrinter(handle)
            finally:
                win32print.EndDocPrinter(handle)
        finally:
            win32print.ClosePrinter(handle)
        return True
    except Exception as e:
        print(f"Error printing: {str(e)}")
        return False

def print_test():
    printer_name = "Honeywell PC42t plus (203 dpi)"
    
    print(f"Printing to: {printer_name}")

    # EPL commands
    # N - Clear image buffer
    # R - Reset printer
    # S - Set speed (3 = 3.0 ips)
    # Q - Set label height
    # A - Text field definition
    # P - Print
    epl_commands = [
        "\nN\n",                    # Clear buffer
        "R\n",                      # Reset printer
        "S3\n",                     # Set speed to ~3.0 ips
        "D8\n",                     # Set print density
        "Q200,24\n",               # Set label height
        "A50,50,0,4,1,1,N,\"TEST PRINT EPL\"\n",  # Add text
        "A50,100,0,3,1,1,N,\"HONEYWELL PC42T\"\n", # Add more text
        "P1\n"                      # Print 1 label
    ]
    
    print("Sending EPL commands...")
    # Join all commands and convert to bytes
    command_data = ''.join(epl_commands).encode('ascii')
    
    if print_raw_data(printer_name, command_data):
        print("Print commands sent successfully")
        return True
    else:
        print("Failed to send print commands")
        return False

if __name__ == "__main__":
    print_test()