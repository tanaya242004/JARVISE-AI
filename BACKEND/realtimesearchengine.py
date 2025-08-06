from googlesearch import search
from groq import Groq
from json import load,dump
import datetime
# from dotenv import dotenv_values
client=Groq(api_key="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")
try:
    with open("chat.json","r") as f:
        messages=load(f)
except:
    with open("chat.json","w") as f:
        dump([],f)

def google_search(query):
    results=list(search(query,advanced=True,num_results=5))
    answers=f"The result for your query '{query}' are:\n[start]\n"
    for i in results:
        answers+=f"{i.title}\n:{i.description}\n"
    answers+="[end]"
    return answers

def AnswerModifier(answers):
    lines=answers.split("\n")
    non_empty_lines=[line for line in lines if line.strip() ]
    modified_answers="\n".join(non_empty_lines)
    return modified_answers
systemchatbot=[
    {
        "role": "system",
        "content": "You are a helpful assistant that provides answers to user queries based on real-time search results."
    },
    {
        "role": "user",
        "content": "hi"
    },
    {
        "role": "assistant",
        "content": "hellow there! How can I assist you today?"
    }
]
def Information_realtime():
    data=""
    current_date_time= datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    data+= f"current date and time is:{current_date_time}\n"
    return data
def RealtimeSearchEngine(prompt):
    global messages, systemchatbot
    with open("chat.json","r") as f:
        messages= load(f)
    messages.append({"role": "user", "content": prompt})
    systemchatbot.append({"role": "user", "content": google_search(prompt)})
    resp=client.chat.completions.create(
        model="llama3-70b-8192",
        messages=systemchatbot,
        max_tokens=2000,
        temperature=0.7,
        top_p=0.9,
        stop=None,
        stream=True
    )
    Answer=""
    for chunk in resp:
        if chunk.choices[0].delta.content:
            Answer+=chunk.choices[0].delta.content
    Answer=Answer.strip().replace("</s>","")
    messages.append({"role": "assistant", "content": Answer})
    with open("chat.json","w") as f:
        dump(messages,f)
    systemchatbot.pop()
    return AnswerModifier(Answer)
if __name__ == "__main__":
    while True:
        prompt=input("\n\nEnter your query: ")
        print(RealtimeSearchEngine(prompt))
        

    









    