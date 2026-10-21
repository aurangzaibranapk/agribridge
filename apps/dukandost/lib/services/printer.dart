import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

import 'bill.dart';

class PrinterService {
  Future<List<BluetoothInfo>> paired() => PrintBluetoothThermal.pairedBluetooths;

  /// Prints to [mac], or the first paired printer. Returns false if none.
  Future<bool> printBill(BillData b, {String? mac, int width = 32}) async {
    var target = mac;
    if (target == null) {
      final list = await paired();
      if (list.isEmpty) return false;
      target = list.first.macAdress;
    }
    if (!await PrintBluetoothThermal.connectionStatus) {
      if (!await PrintBluetoothThermal.connect(macPrinterAddress: target)) return false;
    }
    return PrintBluetoothThermal.writeBytes(escPos(billText(b, width: width)));
  }
}
