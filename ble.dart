// Simple BLE scan and connect example using flutter_blue
import 'dart:async';
import 'package:flutter_blue/flutter_blue.dart';

class BleManager {
  FlutterBlue _flutterBlue = FlutterBlue.instance;
  StreamSubscription? _scanSub;

  void startScan(void Function(List<ScanResult>) onResults) {
    _scanSub = _flutterBlue.scan(timeout: Duration(seconds: 5)).listen((r) {
      // collect and pass results when scan completes handled by caller in real app
    }, onDone: () async {
      var results = await _flutterBlue.scanResults.first;
      onResults(results);
    });
  }

  void stopScan() {
    _scanSub?.cancel();
  }

  Future<BluetoothDevice?> connectToFirstMatching(String namePrefix) async {
    var results = await _flutterBlue.scan(timeout: Duration(seconds: 4)).toList();
    // This is simplistic: in real app, filter results properly
    var flat = results.expand((x) => x).toList();
    for (var r in flat) {
      if (r.device.name.startsWith(namePrefix)) {
        await r.device.connect();
        return r.device;
      }
    }
    return null;
  }
}
