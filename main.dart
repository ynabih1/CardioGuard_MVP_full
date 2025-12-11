import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

void main() => runApp(CardioApp());

class CardioApp extends StatefulWidget {
  @override
  _CardioAppState createState() => _CardioAppState();
}

class _CardioAppState extends State<CardioApp> {
  int userId = 1; // for prototype, assume user id 1 exists
  int simulatedHR = 72;
  bool sending = false;
  Timer? timer;

  @override
  void initState() {
    super.initState();
  }

  void startSending() {
    timer = Timer.periodic(Duration(seconds: 3), (_) => sendRandomReading());
    setState(() { sending = true; });
  }

  void stopSending() {
    timer?.cancel();
    setState(() { sending = false; });
  }

  void sendRandomReading() async {
    // simulate heart rate with occasional drop
    Random r = Random();
    int hr = simulatedHR + r.nextInt(8) - 4;
    // occasionally simulate a dangerous drop
    if (r.nextDouble() < 0.05) hr = 35; // simulate bradycardia
    // simulate accel (x,y,z) small random, occasional spike
    double ax = (r.nextDouble()-0.5)*2;
    double ay = (r.nextDouble()-0.5)*2;
    double az = (r.nextDouble()-0.5)*2;
    if (r.nextDouble() < 0.03) { ax = 20.0; ay = 0.5; az = 0.3; } // simulate fall spike

    var payload = {
      "user_id": userId,
      "heart_rate": hr,
      "accel": {"x": ax, "y": ay, "z": az}
    };

    try {
      var res = await http.post(
        Uri.parse('http://10.0.2.2:3000/api/readings'), // Android emulator localhost mapping
        headers: {"Content-Type":"application/json"},
        body: jsonEncode(payload)
      );
      if (res.statusCode == 200) {
        var j = jsonDecode(res.body);
        print('sent reading hr=$hr accel=[$ax,$ay,$az] -> emergency=${j["emergency"]}');
        if (j["emergency"] == true) {
          showDialog(context: context, builder: (_) => AlertDialog(
            title: Text('إنذار طارئ'),
            content: Text('النظام اكتشف حالة طارئة (HR=$hr)'),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text('إغلاق'))],
          ));
        }
      } else {
        print('Backend error ${res.statusCode}');
      }
    } catch (e) {
      print('Error sending reading: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: Text('CardioGuard - MVP')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('محاكاة قراءات النبض', style: TextStyle(fontSize: 20)),
              SizedBox(height: 20),
              ElevatedButton(
                onPressed: sending ? stopSending : startSending,
                child: Text(sending ? 'إيقاف الإرسال' : 'بدء الإرسال')
              ),
              SizedBox(height: 12),
              ElevatedButton(
                onPressed: () async {
                  // quick manual emergency test
                  var payload = {
                    "user_id": userId,
                    "heart_rate": 30,
                    "accel": {"x":0,"y":0,"z":0}
                  };
                  await http.post(Uri.parse('http://10.0.2.2:3000/api/readings'),
                    headers: {"Content-Type":"application/json"},
                    body: jsonEncode(payload));
                },
                child: Text('اختبار إنذار فوري')
              )
            ],
          ),
        ),
      ),
    );
  }
