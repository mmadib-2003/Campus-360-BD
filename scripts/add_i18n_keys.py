#!/usr/bin/env python3
"""Merge the new UI strings into messages/en.json and messages/bn.json."""
import json
from pathlib import Path

ROOT = Path('/home/user/Campus-360-BD/apps/web/messages')

NEW_KEYS = {
    # Theme toggle
    'Switch to light mode': 'লাইট মোডে দেখুন',
    'Switch to dark mode': 'ডার্ক মোডে দেখুন',
    # Role names
    'Platform Admin': 'প্ল্যাটফর্ম অ্যাডমিন',
    'University Governance': 'বিশ্ববিদ্যালয় গভর্ন্যান্স',
    'Password': 'পাসওয়ার্ড',
    'Role': 'ভূমিকা',
    'University': 'বিশ্ববিদ্যালয়',
    'Students': 'শিক্ষার্থীরা',
    'Residents': 'আবাসিক শিক্ষার্থীরা',
    'Message': 'বার্তা',
    'Audience': 'শ্রোতা',
    'All': 'সবাই',
    'Actions': 'অ্যাকশন',
    'Create': 'তৈরি করুন',
    'Edit': 'সম্পাদনা',
    'Delete': 'মুছুন',
    'Cancel': 'বাতিল',
    'Save changes': 'পরিবর্তন সংরক্ষণ',
    'Search': 'খুঁজুন',
    'Select': 'নির্বাচন করুন',
    'Yes': 'হ্যাঁ',
    'No': 'না',
    'Required': 'আবশ্যক',
    'Created': 'তৈরি হয়েছে',
    'Updated': 'আপডেট হয়েছে',
    'Deleted': 'মুছে ফেলা হয়েছে',
    'Signing in…': 'সাইন ইন হচ্ছে…',
    'Verification failed': 'যাচাইকরণ ব্যর্থ হয়েছে',
    # Demo OTP (Track B)
    'Demo OTP': 'ডেমো ওটিপি',
    'Demo mode is on — no email is sent. Use this unique code for this email address.':
        'ডেমো মোড চালু আছে — কোনো ইমেইল পাঠানো হয় না। এই ইমেইল ঠিকানার জন্য এই অনন্য কোডটি ব্যবহার করুন।',
    'Valid for {minutes} minutes': '{minutes} মিনিটের জন্য বৈধ',
    'The code is a deterministic SHA-256 hash of the email address and is stored in profiles.demo_otp with a 10-minute TTL.':
        'কোডটি ইমেইল ঠিকানার একটি নির্দিষ্ট SHA-256 হ্যাশ এবং profiles.demo_otp-এ ১০ মিনিটের মেয়াদে সংরক্ষিত থাকে।',
    # Dev sign-in panel
    'Demo accounts (Dev sign-in)': 'ডেমো অ্যাকাউন্ট (ডেভ সাইন-ইন)',
    'Password sign-in with pre-seeded accounts — bypasses OTP email limits. Every demo password is Demo#1234.':
        'পূর্ব-সিড করা অ্যাকাউন্ট দিয়ে পাসওয়ার্ড সাইন-ইন — ওটিপি ইমেইলের সীমা এড়ানো হয়। সব ডেমো পাসওয়ার্ড Demo#1234।',
    'Sign in with demo account': 'ডেমো অ্যাকাউন্টে সাইন ইন করুন',
    'See all demo accounts': 'সব ডেমো অ্যাকাউন্ট দেখুন',
    # /demo page
    'Demo accounts': 'ডেমো অ্যাকাউন্ট',
    'One student, one platform admin and one governance account per university — password sign-in, no OTP email limits.':
        'প্রতি বিশ্ববিদ্যালয়ে একজন শিক্ষার্থী, একজন প্ল্যাটফর্ম অ্যাডমিন ও একটি গভর্ন্যান্স অ্যাকাউন্ট — পাসওয়ার্ড সাইন-ইন, ওটিপি ইমেইলের সীমা নেই।',
    'Password for every account': 'প্রতিটি অ্যাকাউন্টের পাসওয়ার্ড',
    'How demo sign-in works': 'ডেমো সাইন-ইন যেভাবে কাজ করে',
    # Hall selection
    'Residential Hall': 'আবাসিক হল',
    'Search your residential hall…': 'আপনার আবাসিক হল খুঁজুন…',
    'Required for students — your hall allocation is verified by the hall office.':
        'শিক্ষার্থীদের জন্য আবশ্যক — আপনার হল বরাদ্দ হল অফিস কর্তৃক যাচাই করা হয়।',
    'Select your residential hall to continue': 'চালিয়ে যেতে আপনার আবাসিক হল নির্বাচন করুন',
    'No halls registered for this university yet': 'এই বিশ্ববিদ্যালয়ের জন্য এখনো কোনো হল নিবন্ধিত হয়নি',
    'No hall found': 'কোনো হল পাওয়া যায়নি',
    'Day scholar': 'দিবাকালীন শিক্ষার্থী',
    'Residential': 'আবাসিক',
    # Admin panel
    'Platform Admin Panel': 'প্ল্যাটফর্ম অ্যাডমিন প্যানেল',
    'Platform operators only.': 'শুধুমাত্র প্ল্যাটফর্ম অপারেটরদের জন্য।',
    'Sign in with a platform admin account to manage the registry.':
        'রেজিস্ট্রি পরিচালনা করতে একটি প্ল্যাটফর্ম অ্যাডমিন অ্যাকাউন্টে সাইন ইন করুন।',
    'Full create, edit and delete control over every registry model — users, universities, halls, marketplace, civic tickets, events, blood requests, lost items, housing, careers, cafeteria menus and disputes.':
        'প্রতিটি রেজিস্ট্রি মডেলের উপর সম্পূর্ণ তৈরি, সম্পাদনা ও মুছে ফেলার নিয়ন্ত্রণ — ব্যবহারকারী, বিশ্ববিদ্যালয়, হল, মার্কেটপ্লেস, সিভিক টিকিট, ইভেন্ট, রক্তের আবেদন, হারানো জিনিস, হাউজিং, ক্যারিয়ার, ক্যাফেটেরিয়া মেনু ও বিবাদ।',
    'Create, edit and delete rows. Changes propagate live over Supabase Realtime.':
        'সারি তৈরি, সম্পাদনা ও মুছে ফেলুন। পরিবর্তন সুপাবেস রিয়েলটাইমে সরাসরি প্রতিফলিত হয়।',
    'Nothing here yet': 'এখনো এখানে কিছু নেই',
    'Create the first row for this section.': 'এই বিভাগের প্রথম সারিটি তৈরি করুন।',
    'Delete this row?': 'এই সারিটি মুছে ফেলবেন?',
    'This permanently removes the row. This action cannot be undone.':
        'এটি সারিটি স্থায়ীভাবে মুছে ফেলে। এই কাজটি ফিরিয়ে আনা যায় না।',
    'Users': 'ব্যবহারকারী',
    'Universities': 'বিশ্ববিদ্যালয়সমূহ',
    'Halls': 'হলসমূহ',
    'Marketplace Listings': 'মার্কেটপ্লেস তালিকা',
    'Civic Tickets': 'সিভিক টিকিট',
    'Blood Requests': 'রক্তের আবেদন',
    'Lost Items': 'হারানো জিনিস',
    'Housing Listings': 'হাউজিং তালিকা',
    'Career Posts': 'ক্যারিয়ার পোস্ট',
    'Cafeteria Menus': 'ক্যাফেটেরিয়া মেনু',
    'Disputes': 'বিবাদ',
    'Events': 'ইভেন্ট',
    'Your campus': 'আপনার ক্যাম্পাস',
    # Governance dashboard
    'University Governance Dashboard': 'বিশ্ববিদ্যালয় গভর্ন্যান্স ড্যাশবোর্ড',
    'University governing bodies only.': 'শুধুমাত্র বিশ্ববিদ্যালয় গভর্নিং বডির জন্য।',
    'Sign in with a governance account to moderate your campus.':
        'আপনার ক্যাম্পাস পরিচালনা করতে একটি গভর্ন্যান্স অ্যাকাউন্টে সাইন ইন করুন।',
    'Moderate civic complaints, approve hall allocations and broadcast notices — scoped to your own university only.':
        'সিভিক অভিযোগ পরিচালনা, হল বরাদ্দ অনুমোদন ও নোটিশ সম্প্রচার করুন — শুধুমাত্র আপনার নিজের বিশ্ববিদ্যালয়ের জন্য।',
    'Open grievances': 'খোলা অভিযোগ',
    'Hall allocations pending': 'অপেক্ষমাণ হল বরাদ্দ',
    'Notices broadcast': 'সম্প্রচারিত নোটিশ',
    'Civic complaints': 'সিভিক অভিযোগ',
    'Hall allocations': 'হল বরাদ্দ',
    'Notice broadcasts': 'নোটিশ সম্প্রচার',
    'Every action is scoped to your university.': 'প্রতিটি কাজ আপনার বিশ্ববিদ্যালয়ের মধ্যে সীমাবদ্ধ।',
    'Broadcast notice': 'নোটিশ সম্প্রচার করুন',
    'No complaints yet': 'এখনো কোনো অভিযোগ নেই',
    'Civic board tickets will appear here for moderation.': 'পরিচালনার জন্য সিভিক বোর্ডের টিকিট এখানে দেখা যাবে।',
    'No allocations yet': 'এখনো কোনো বরাদ্দ নেই',
    'Hall seat requests will appear here.': 'হল আসনের আবেদন এখানে দেখা যাবে।',
    'No notices yet': 'এখনো কোনো নোটিশ নেই',
    'Broadcast your first notice to students.': 'শিক্ষার্থীদের জন্য আপনার প্রথম নোটিশ সম্প্রচার করুন।',
    'Approve': 'অনুমোদন',
    'Reject': 'প্রত্যাখ্যান',
    'Approved': 'অনুমোদিত',
    'Rejected': 'প্রত্যাখ্যাত',
    'Status updated': 'স্ট্যাটাস আপডেট হয়েছে',
    'Moderate': 'পরিচালনা',
    'Resolution note': 'সমাধানের নোট',
    'Visible on the public tracking timeline.': 'পাবলিক ট্র্যাকিং টাইমলাইনে দৃশ্যমান।',
    'Notice broadcast to students': 'শিক্ষার্থীদের কাছে নোটিশ সম্প্রচারিত হয়েছে',
    # Common field labels (admin forms)
    'Title': 'শিরোনাম',
    'Description': 'বিবরণ',
    'Category': 'শ্রেণি',
    'Severity': 'তীব্রতা',
    'Status': 'স্ট্যাটাস',
    'Location Hint': 'অবস্থানের ইঙ্গিত',
    'Code': 'কোড',
    'Name En': 'নাম (ইংরেজি)',
    'Name Bn': 'নাম (বাংলা)',
    'Type': 'ধরন',
    'Is Active': 'সক্রিয়',
    'Full Name': 'পুরো নাম',
    'Student ID': 'শিক্ষার্থী আইডি',
    'Student Id': 'শিক্ষার্থী আইডি',
    'Batch': 'ব্যাচ',
    'Trust Level': 'বিশ্বাসের মাত্রা',
    'City': 'শহর',
    'Lat': 'অক্ষাংশ',
    'Lng': 'দ্রাঘিমাংশ',
    'Kind': 'ধরন',
    'Price Bdt': 'মূল্য (টাকা)',
    'Tracking Code': 'ট্র্যাকিং কোড',
    'Venue Name': 'ভেন্যুর নাম',
    'Starts At': 'শুরুর সময়',
    'Capacity': 'ধারণক্ষমতা',
    'Patient Name': 'রোগীর নাম',
    'Blood Group': 'রক্তের গ্রুপ',
    'Bags Needed': 'প্রয়োজনীয় ব্যাগ',
    'Hospital Name': 'হাসপাতালের নাম',
    'Hospital Address': 'হাসপাতালের ঠিকানা',
    'Urgency': 'জরুরিত্ব',
    'Area En': 'এলাকা (ইংরেজি)',
    'Rent Bdt': 'ভাড়া (টাকা)',
    'Seat Count': 'আসন সংখ্যা',
    'Company': 'প্রতিষ্ঠান',
    'Location': 'অবস্থান',
    'Meal': 'খাবার',
    'Serving Date': 'পরিবেশনের তারিখ',
    'Pickup Window': 'সংগ্রহের সময়',
    'Subject': 'বিষয়',
    'Body': 'বিবরণ',
    'Title En': 'শিরোনাম (ইংরেজি)',
    'Title Bn': 'শিরোনাম (বাংলা)',
    'Description En': 'বিবরণ (ইংরেজি)',
    'Serving Date': 'পরিবেশনের তারিখ',
}


def merge(path: Path, use_bn: bool):
    data = json.loads(path.read_text(encoding='utf-8'))
    ui = data.setdefault('ui', {})
    added = 0
    for key, bn_value in NEW_KEYS.items():
        if key not in ui:
            ui[key] = bn_value if use_bn else key
            added += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{path.name}: +{added} keys (total ui: {len(ui)})')


merge(ROOT / 'en.json', use_bn=False)
merge(ROOT / 'bn.json', use_bn=True)
